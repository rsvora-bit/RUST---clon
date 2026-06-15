using UnityEngine;
using UnityEngine.InputSystem;

namespace FarkensWorld
{
    public sealed class GameManager : MonoBehaviour
    {
        public const string Version = "Farken's World - Unity Beta 1.6.0";

        public static GameManager Instance { get; private set; }

        public Inventory PlayerInventory { get; private set; }
        public Hotbar Hotbar { get; private set; }
        public FirstPersonController PlayerController { get; private set; }
        public PlayerStats PlayerStats { get; private set; }
        public CraftingManager Crafting { get; private set; }
        public BuildSystem Building { get; private set; }
        public SaveManager Saves { get; private set; }
        public DroppedItemWorldSpawner Drops { get; private set; }
        public InventoryUI InventoryUI { get; private set; }
        public BuildUI BuildUI { get; private set; }
        public PauseMenuUI PauseUI { get; private set; }
        public DevConsoleUI ConsoleUI { get; private set; }
        public MapUI MapUI { get; private set; }
        public WorldGenerator World { get; private set; }
        public RuntimeSafety Safety { get; private set; }
        public GameSettings Settings { get; private set; }
        public WorldEnvironment Environment { get; private set; }
        public WorldPopulation Population { get; private set; }
        public SettingsUI SettingsUI { get; private set; }
        public DeathUI DeathUI { get; private set; }
        public ProceduralAudio Audio { get; private set; }
        public bool IsDead { get; private set; }

        public bool InventoryOpen => InventoryUI != null && InventoryUI.IsOpen;
        public bool BuildMenuOpen => BuildUI != null && BuildUI.IsOpen;
        public bool PauseOpen => PauseUI != null && PauseUI.IsOpen;
        public bool ConsoleOpen => ConsoleUI != null && ConsoleUI.IsOpen;
        public bool MapOpen => MapUI != null && MapUI.IsOpen;
        public bool SettingsOpen => SettingsUI != null && SettingsUI.IsOpen;
        public bool ContainerOpen => InventoryUI != null && InventoryUI.ActiveContainer != null;
        public bool GameplayInputBlocked => IsDead || InventoryOpen || BuildMenuOpen || PauseOpen || ConsoleOpen || MapOpen || SettingsOpen || ContainerOpen;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
            gameObject.name = "Farken's World - Game Manager";
            InitializeRuntime();
        }

        private void Update()
        {
            Keyboard keyboard = Keyboard.current;
            if (keyboard == null)
            {
                return;
            }

            if (!ConsoleOpen && keyboard.tabKey.wasPressedThisFrame)
            {
                InventoryUI.Toggle();
            }

            if (!ConsoleOpen && keyboard.bKey.wasPressedThisFrame)
            {
                BuildUI.Toggle();
            }

            if (!ConsoleOpen && keyboard.mKey.wasPressedThisFrame)
            {
                MapUI.Toggle();
            }

            if (!ConsoleOpen && keyboard.oKey.wasPressedThisFrame)
            {
                SettingsUI.Toggle();
            }

            if (!GameplayInputBlocked && keyboard.hKey.wasPressedThisFrame)
            {
                UseBandage();
            }

            if (!GameplayInputBlocked && keyboard.gKey.wasPressedThisFrame)
            {
                UseFood();
            }

            if (!ConsoleOpen && keyboard.escapeKey.wasPressedThisFrame)
            {
                if (IsDead)
                {
                    return;
                }
                if (InventoryOpen || BuildMenuOpen || ContainerOpen || MapOpen || SettingsOpen)
                {
                    ClosePanels();
                }
                else
                {
                    PauseUI.Toggle();
                }
            }

            UpdateCursor();
        }

        public void ClosePanels()
        {
            InventoryUI.Close();
            BuildUI.Close();
            PauseUI.Close();
            MapUI.Close();
            SettingsUI.Close();
        }

        public void SetStarterInventory()
        {
            PlayerInventory.Clear();
            PlayerInventory.Add("rock", 1);
            PlayerInventory.Add("torch", 1);
            PlayerInventory.Add("buildingPlan", 1);
            PlayerInventory.Add("bandage", 1);
            PlayerInventory.Add("mushroom", 2);
            PlayerInventory.Add("wood", 70);
            PlayerInventory.Add("stone", 45);
            PlayerInventory.Add("cloth", 10);
            Hotbar.Select(0);
        }

        public void NewGame()
        {
            IsDead = false;
            DeathUI.Close();
            ClosePanels();
            int seed = Random.Range(1000, 999999);
            GenerateWorld(seed, true);
            PlayerController.Teleport(World.PlayerSpawn);
            PlayerStats.ResetStats();
            SetStarterInventory();
            Building.ClearAll();
            Drops.ClearAll();
            GameEvents.RaiseCenter("New island generated");
        }

        public void Respawn()
        {
            IsDead = false;
            DeathUI.Close();
            PlayerController.Teleport(World.PlayerSpawn);
            PlayerStats.Respawn();
            GameEvents.RaiseCenter("Respawned on the island");
        }

        public void HandlePlayerDeath(string reason)
        {
            if (IsDead)
            {
                return;
            }

            IsDead = true;
            ClosePanels();
            DeathUI.Show(reason);
            Audio.Play(AudioCue.Death);
            GameEvents.RaiseFeed("You died: " + reason);
        }

        public void ClearDeathState()
        {
            IsDead = false;
            DeathUI.Close();
        }

        public void GenerateWorld(int seed, bool resetEnvironment = false)
        {
            World.Generate(seed);
            Environment.RefreshWorldReferences();
            if (resetEnvironment) Environment.ResetForNewWorld(seed);
            Population.Generate(seed);
        }

        private void InitializeRuntime()
        {
            PlayerInventory = new Inventory(28);
            Hotbar = new Hotbar(PlayerInventory);

            Drops = gameObject.AddComponent<DroppedItemWorldSpawner>();
            Crafting = gameObject.AddComponent<CraftingManager>();
            Building = gameObject.AddComponent<BuildSystem>();
            Saves = gameObject.AddComponent<SaveManager>();
            World = gameObject.AddComponent<WorldGenerator>();
            Environment = gameObject.AddComponent<WorldEnvironment>();
            Population = gameObject.AddComponent<WorldPopulation>();
            Settings = gameObject.AddComponent<GameSettings>();
            Audio = gameObject.AddComponent<ProceduralAudio>();
            Safety = gameObject.AddComponent<RuntimeSafety>();

            gameObject.AddComponent<HUDController>();
            InventoryUI = gameObject.AddComponent<InventoryUI>();
            BuildUI = gameObject.AddComponent<BuildUI>();
            PauseUI = gameObject.AddComponent<PauseMenuUI>();
            ConsoleUI = gameObject.AddComponent<DevConsoleUI>();
            MapUI = gameObject.AddComponent<MapUI>();
            SettingsUI = gameObject.AddComponent<SettingsUI>();
            DeathUI = gameObject.AddComponent<DeathUI>();

            GenerateWorld(151, true);
            CreatePlayer();
            SetStarterInventory();
            Settings.Apply();
            if (RuntimeSmokeTest.Requested)
            {
                gameObject.AddComponent<RuntimeSmokeTest>();
            }
        }

        private void CreatePlayer()
        {
            GameObject player = new GameObject("Player");
            CharacterController characterController = player.AddComponent<CharacterController>();
            characterController.height = 1.8f;
            characterController.radius = 0.36f;
            characterController.center = new Vector3(0f, 0.9f, 0f);
            characterController.stepOffset = 0.35f;
            characterController.slopeLimit = 50f;

            PlayerStats = player.AddComponent<PlayerStats>();
            PlayerController = player.AddComponent<FirstPersonController>();
            player.AddComponent<PlayerInteraction>();
            player.AddComponent<PlayerCombat>();
            PlayerController.Teleport(World.PlayerSpawn);
        }

        private void UseBandage()
        {
            if (!PlayerInventory.Remove("bandage", 1))
            {
                GameEvents.RaiseCenter("No bandage in inventory");
                return;
            }

            PlayerStats.Heal(18f);
            PlayerStats.ReduceBleeding(22f);
            GameEvents.RaiseCenter("Bandage used");
        }

        private void UseFood()
        {
            if (PlayerInventory.Remove("cookedMeat", 1))
            {
                PlayerStats.Feed(32f);
                PlayerStats.Heal(4f);
                GameEvents.RaiseCenter("Cooked meat eaten");
                return;
            }

            if (PlayerInventory.Remove("mushroom", 1))
            {
                PlayerStats.Feed(12f);
                PlayerStats.Heal(2f);
                GameEvents.RaiseCenter("Mushroom eaten");
                return;
            }

            GameEvents.RaiseCenter("No food in inventory");
        }

        private void UpdateCursor()
        {
            bool showCursor = GameplayInputBlocked;
            Cursor.lockState = showCursor ? CursorLockMode.None : CursorLockMode.Locked;
            Cursor.visible = showCursor;
        }
    }
}
