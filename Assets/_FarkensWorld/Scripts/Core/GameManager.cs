using UnityEngine;
using UnityEngine.InputSystem;

namespace FarkensWorld
{
    public sealed class GameManager : MonoBehaviour
    {
        public const string Version = "Unity Prototype 0.1";

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
        public WorldGenerator World { get; private set; }

        public bool InventoryOpen => InventoryUI != null && InventoryUI.IsOpen;
        public bool BuildMenuOpen => BuildUI != null && BuildUI.IsOpen;
        public bool PauseOpen => PauseUI != null && PauseUI.IsOpen;
        public bool ConsoleOpen => ConsoleUI != null && ConsoleUI.IsOpen;
        public bool ContainerOpen => InventoryUI != null && InventoryUI.ActiveContainer != null;
        public bool GameplayInputBlocked => InventoryOpen || BuildMenuOpen || PauseOpen || ConsoleOpen || ContainerOpen;

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

            if (!ConsoleOpen && keyboard.escapeKey.wasPressedThisFrame)
            {
                if (InventoryOpen || BuildMenuOpen || ContainerOpen)
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
            ClosePanels();
            World.ClearRuntimeWorld();
            World.Generate(Random.Range(1000, 999999));
            PlayerController.Teleport(World.PlayerSpawn);
            PlayerStats.ResetStats();
            SetStarterInventory();
            Building.ClearAll();
            Drops.ClearAll();
            GameEvents.RaiseCenter("New island generated");
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

            gameObject.AddComponent<HUDController>();
            InventoryUI = gameObject.AddComponent<InventoryUI>();
            BuildUI = gameObject.AddComponent<BuildUI>();
            PauseUI = gameObject.AddComponent<PauseMenuUI>();
            ConsoleUI = gameObject.AddComponent<DevConsoleUI>();

            World.Generate(151);
            CreatePlayer();
            SetStarterInventory();
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

        private void UpdateCursor()
        {
            bool showCursor = GameplayInputBlocked;
            Cursor.lockState = showCursor ? CursorLockMode.None : CursorLockMode.Locked;
            Cursor.visible = showCursor;
        }
    }
}
