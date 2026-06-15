using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace FarkensWorld
{
    [Serializable]
    public sealed class GameSaveData
    {
        public string version = GameManager.Version;
        public int worldSeed = 151;
        public Vector3 playerPosition;
        public float playerYaw;
        public PlayerStatsData stats = new PlayerStatsData();
        public int selectedHotbar;
        public List<InventorySlot> inventory = new List<InventorySlot>();
        public List<BuildSaveData> builds = new List<BuildSaveData>();
        public List<DropSaveData> drops = new List<DropSaveData>();
        public EnvironmentSaveData environment = new EnvironmentSaveData();
        public GameSettingsData settings = new GameSettingsData();
    }

    [Serializable]
    public sealed class BuildSaveData
    {
        public BuildPieceType type;
        public BuildGrade grade;
        public Vector3 position;
        public float rotationY;
        public float health;
        public List<InventorySlot> containerSlots = new List<InventorySlot>();
        public bool furnaceActive;
        public float furnaceProgress;
    }

    [Serializable]
    public sealed class DropSaveData
    {
        public string itemId;
        public int amount;
        public int durability;
        public Vector3 position;
    }

    public sealed class SaveManager : MonoBehaviour
    {
        public string SavePath => Path.Combine(Application.persistentDataPath, "farkens-world-save.json");
        public bool HasSave => File.Exists(SavePath);

        public void SaveGame()
        {
            try
            {
                GameManager game = GameManager.Instance;
                GameSaveData data = new GameSaveData
                {
                    worldSeed = game.World.WorldSeed,
                    playerPosition = game.PlayerController.transform.position,
                    playerYaw = game.PlayerController.Yaw,
                    selectedHotbar = game.Hotbar.SelectedIndex,
                    inventory = game.PlayerInventory.CreateSnapshot(),
                    stats = CopyStats(game.PlayerStats.Values),
                    environment = game.Environment.CreateSnapshot(),
                    settings = game.Settings.CreateSnapshot()
                };

                foreach (BuildPiece piece in game.Building.PlacedPieces)
                {
                    if (piece == null) continue;
                    BuildSaveData build = new BuildSaveData
                    {
                        type = piece.Type,
                        grade = piece.Grade,
                        position = piece.transform.position,
                        rotationY = piece.transform.eulerAngles.y,
                        health = piece.Health
                    };
                    ContainerInventory container = piece.GetComponent<ContainerInventory>();
                    if (container != null) build.containerSlots = container.CreateSnapshot();
                    Furnace furnace = piece.GetComponent<Furnace>();
                    if (furnace != null)
                    {
                        build.furnaceActive = furnace.IsActive;
                        build.furnaceProgress = furnace.Progress01 * 5f;
                    }
                    data.builds.Add(build);
                }

                foreach (DroppedItem drop in game.Drops.GetActiveDrops())
                {
                    data.drops.Add(new DropSaveData { itemId = drop.ItemId, amount = drop.Amount, durability = drop.Durability, position = drop.transform.position });
                }

                File.WriteAllText(SavePath, JsonUtility.ToJson(data, true));
                GameEvents.RaiseCenter("Game saved");
            }
            catch (Exception exception)
            {
                Debug.LogError("Save failed: " + exception);
                GameEvents.RaiseCenter("Save failed - see Console");
            }
        }

        public void LoadGame()
        {
            if (!HasSave)
            {
                GameEvents.RaiseCenter("No save found - starting new game");
                GameManager.Instance.NewGame();
                return;
            }

            try
            {
                string json = File.ReadAllText(SavePath);
                GameSaveData data = JsonUtility.FromJson<GameSaveData>(json);
                if (data == null) throw new InvalidDataException("Save file is empty or invalid.");

                GameManager game = GameManager.Instance;
                game.ClearDeathState();
                game.ClosePanels();
                game.GenerateWorld(data.worldSeed == 0 ? 151 : data.worldSeed);
                game.PlayerController.Teleport(data.playerPosition, data.playerYaw, false);
                game.PlayerStats.Restore(data.stats);
                game.Environment.Restore(data.environment);
                game.Settings.Restore(data.settings);
                game.PlayerInventory.Restore(data.inventory);
                game.Hotbar.RestoreSelection(data.selectedHotbar);
                game.Building.ClearAll();
                game.Drops.ClearAll();

                if (data.builds != null)
                {
                    foreach (BuildSaveData saved in data.builds)
                    {
                        BuildPiece piece = game.Building.CreatePlacedPiece(saved.type, saved.position, Quaternion.Euler(0f, saved.rotationY, 0f));
                        piece.Restore(saved.grade, saved.health);
                        ContainerInventory container = piece.GetComponent<ContainerInventory>();
                        if (container != null) container.Restore(saved.containerSlots);
                        Furnace furnace = piece.GetComponent<Furnace>();
                        if (furnace != null) furnace.RestoreState(saved.furnaceActive, saved.furnaceProgress);
                    }
                }

                if (data.drops != null)
                {
                    foreach (DropSaveData savedDrop in data.drops)
                    {
                        game.Drops.Spawn(savedDrop.itemId, savedDrop.amount, savedDrop.position, savedDrop.durability);
                    }
                }

                GameEvents.RaiseCenter("Game loaded");
            }
            catch (Exception exception)
            {
                Debug.LogError("Load failed: " + exception);
                GameEvents.RaiseCenter("Load failed - save was not applied");
            }
        }

        private static PlayerStatsData CopyStats(PlayerStatsData source)
        {
            return new PlayerStatsData
            {
                health = source.health,
                hunger = source.hunger,
                thirst = source.thirst,
                stamina = source.stamina,
                wetness = source.wetness,
                radiation = source.radiation,
                bleeding = source.bleeding,
                temperature = source.temperature
            };
        }
    }
}
