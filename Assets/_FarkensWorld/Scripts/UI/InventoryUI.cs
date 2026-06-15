using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace FarkensWorld
{
    public sealed class InventoryUI : MonoBehaviour
    {
        private readonly Button[] playerSlots = new Button[28];
        private readonly Button[] containerSlots = new Button[12];
        private readonly List<Button> recipeButtons = new List<Button>();
        private readonly Button[] queueButtons = new Button[3];

        private GameObject root;
        private GameObject containerPanel;
        private RectTransform inventoryPanel;
        private RectTransform craftingPanel;
        private Text inventoryInfo;
        private Text containerTitle;
        private Text furnaceProgress;
        private Button furnaceToggle;
        private int selectedSlot = -1;
        private float nextRefresh;

        public bool IsOpen { get; private set; }
        public ContainerInventory ActiveContainer { get; private set; }

        private void OnEnable()
        {
            GameEvents.InventoryChanged += RefreshAll;
        }

        private void OnDisable()
        {
            GameEvents.InventoryChanged -= RefreshAll;
        }

        private void Start()
        {
            BuildCanvas();
            root.SetActive(false);
        }

        private void Update()
        {
            if (!IsOpen || Time.unscaledTime < nextRefresh)
            {
                return;
            }

            nextRefresh = Time.unscaledTime + 0.15f;
            RefreshCrafting();
            RefreshContainer();
        }

        public void Toggle()
        {
            if (IsOpen)
            {
                Close();
                return;
            }

            GameManager.Instance.BuildUI.Close();
            GameManager.Instance.MapUI.Close();
            IsOpen = true;
            root.SetActive(true);
            RefreshAll();
        }

        public void Close()
        {
            IsOpen = false;
            ActiveContainer = null;
            selectedSlot = -1;
            if (root != null)
            {
                root.SetActive(false);
            }
        }

        public void OpenContainer(ContainerInventory container)
        {
            ActiveContainer = container;
            IsOpen = true;
            GameManager.Instance.BuildUI.Close();
            GameManager.Instance.MapUI.Close();
            root.SetActive(true);
            RefreshAll();
        }

        private void BuildCanvas()
        {
            Image overlay = RuntimeUI.Image(RuntimeUI.Canvas.transform, "Inventory Overlay", new Color(0.018f, 0.028f, 0.036f, 0.96f),
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            root = overlay.gameObject;

            Image frame = RuntimeUI.Image(root.transform, "Frame", RuntimeUI.Panel, Vector2.zero, Vector2.one,
                new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(-48f, -48f));
            RuntimeUI.Image(frame.transform, "Header", new Color(0.16f, 0.12f, 0.045f, 0.62f),
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), Vector2.zero, new Vector2(0f, 58f));
            RuntimeUI.Label(frame.transform, "Title", "INVENTÁŘ / CRAFTING   •   slots / crafting / containers", 20, RuntimeUI.Accent,
                TextAnchor.MiddleLeft, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -29f), new Vector2(-180f, 58f), FontStyle.Bold);
            RuntimeUI.Button(frame.transform, "Close", "ZAVŘÍT", Close, new Vector2(1f, 1f), new Vector2(1f, 1f),
                new Vector2(1f, 1f), new Vector2(-16f, -10f), new Vector2(136f, 38f));

            BuildContainerPanel(frame.transform);
            BuildInventoryPanel(frame.transform);
            BuildCraftingPanel(frame.transform);
            UpdateLayout();
        }

        private void BuildInventoryPanel(Transform parent)
        {
            Image panel = RuntimeUI.Image(parent, "Player Inventory", RuntimeUI.PanelSoft,
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(32f, -84f), new Vector2(900f, 900f));
            inventoryPanel = panel.rectTransform;
            RuntimeUI.Label(panel.transform, "Section", "SUROVINY A LOOT", 14, RuntimeUI.Accent, TextAnchor.MiddleLeft,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -10f), new Vector2(-24f, 34f), FontStyle.Bold);

            for (int i = 0; i < playerSlots.Length; i++)
            {
                int index = i;
                int row = i / 7;
                int column = i % 7;
                playerSlots[i] = RuntimeUI.Button(panel.transform, "Inventory Slot " + (i + 1), "EMPTY", () => HandlePlayerSlotClick(index),
                    new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f),
                    new Vector2(16f + column * 88f, -52f - row * 112f), new Vector2(82f, 104f), RuntimeUI.SlotEmpty, 10);
            }

            float actionsY = -520f;
            RuntimeUI.Button(panel.transform, "Drop One", "DROP 1", () => DropSelected(1),
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(16f, actionsY), new Vector2(122f, 36f));
            RuntimeUI.Button(panel.transform, "Drop Stack", "DROP STACK", () => DropSelected(int.MaxValue),
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(146f, actionsY), new Vector2(138f, 36f));
            RuntimeUI.Button(panel.transform, "Sort", "SORT", () => GameManager.Instance.PlayerInventory.Sort(),
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(292f, actionsY), new Vector2(112f, 36f));
            RuntimeUI.Button(panel.transform, "Stack", "STACK ALL", RestackInventory,
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(412f, actionsY), new Vector2(132f, 36f));
            inventoryInfo = RuntimeUI.Label(panel.transform, "Info", "Sloty: 0 / 28", 11, RuntimeUI.Muted, TextAnchor.MiddleRight,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, actionsY - 42f), new Vector2(-24f, 24f), FontStyle.Bold);
            RuntimeUI.Label(panel.transform, "Help", "Kliknutí vybere | Alt kliknutí vyhodí 1 | Shift+Alt vyhodí stack | Shift kliknutí přesune",
                11, RuntimeUI.Muted, TextAnchor.MiddleLeft, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 18f), new Vector2(-28f, 28f));
        }

        private void BuildContainerPanel(Transform parent)
        {
            Image panel = RuntimeUI.Image(parent, "Container", RuntimeUI.PanelSoft,
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(32f, -84f), new Vector2(340f, 900f));
            containerPanel = panel.gameObject;
            containerTitle = RuntimeUI.Label(panel.transform, "Title", "KONTEJNER", 14, RuntimeUI.Accent, TextAnchor.MiddleLeft,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -10f), new Vector2(-24f, 34f), FontStyle.Bold);
            RuntimeUI.Button(panel.transform, "Take All", "TAKE ALL", TakeAll,
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(12f, -48f), new Vector2(96f, 34f));
            RuntimeUI.Button(panel.transform, "Deposit", "DEPOSIT ALL", DepositAll,
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(116f, -48f), new Vector2(112f, 34f));
            RuntimeUI.Button(panel.transform, "Sort", "SORT", () => { if (ActiveContainer != null) ActiveContainer.Inventory.Sort(); },
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(236f, -48f), new Vector2(88f, 34f));

            for (int i = 0; i < containerSlots.Length; i++)
            {
                int index = i;
                int row = i / 3;
                int column = i % 3;
                containerSlots[i] = RuntimeUI.Button(panel.transform, "Container Slot " + (i + 1), "EMPTY", () => TransferContainerSlot(index),
                    new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f),
                    new Vector2(12f + column * 106f, -94f - row * 110f), new Vector2(98f, 102f), RuntimeUI.SlotEmpty, 10);
            }

            furnaceToggle = RuntimeUI.Button(panel.transform, "Furnace Toggle", "TURN ON", ToggleFurnace,
                new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(12f, 64f), new Vector2(152f, 38f));
            furnaceProgress = RuntimeUI.Label(panel.transform, "Furnace Progress", string.Empty, 12, RuntimeUI.Accent, TextAnchor.MiddleCenter,
                new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(174f, 64f), new Vector2(150f, 38f), FontStyle.Bold);
            RuntimeUI.Button(panel.transform, "Close Container", "ZAVŘÍT KONTEJNER", CloseContainer,
                new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 16f), new Vector2(-24f, 38f));
        }

        private void BuildCraftingPanel(Transform parent)
        {
            Image panel = RuntimeUI.Image(parent, "Crafting", RuntimeUI.PanelSoft,
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(946f, -84f), new Vector2(942f, 900f));
            craftingPanel = panel.rectTransform;
            RuntimeUI.Label(panel.transform, "Queue Header", "CRAFTING QUEUE", 14, RuntimeUI.Accent, TextAnchor.MiddleLeft,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -10f), new Vector2(-24f, 34f), FontStyle.Bold);

            for (int i = 0; i < queueButtons.Length; i++)
            {
                int index = i;
                queueButtons[i] = RuntimeUI.Button(panel.transform, "Queue " + (i + 1), "Fronta je prázdná", () => GameManager.Instance.Crafting.Cancel(index),
                    new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(0f, -48f - i * 42f), new Vector2(-24f, 36f), RuntimeUI.SlotEmpty, 11);
            }

            RuntimeUI.Label(panel.transform, "Recipes Header", "CRAFTING", 14, RuntimeUI.Accent, TextAnchor.MiddleLeft,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -180f), new Vector2(-24f, 34f), FontStyle.Bold);

            for (int i = 0; i < CraftingDatabase.All.Count; i++)
            {
                RecipeDefinition recipe = CraftingDatabase.All[i];
                int row = i / 2;
                int column = i % 2;
                Button button = RuntimeUI.Button(panel.transform, "Recipe " + recipe.ResultItemId, RecipeLabel(recipe), () => QueueRecipe(recipe),
                    new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f),
                    new Vector2(12f + column * 402f, -222f - row * 82f), new Vector2(390f, 74f), RuntimeUI.CategoryColor(recipe.Category), 11);
                recipeButtons.Add(button);
            }
        }

        private void UpdateLayout()
        {
            bool hasContainer = ActiveContainer != null;
            containerPanel.SetActive(hasContainer);
            inventoryPanel.anchoredPosition = new Vector2(hasContainer ? 386f : 32f, -84f);
            inventoryPanel.sizeDelta = new Vector2(hasContainer ? 650f : 900f, 900f);
            craftingPanel.anchoredPosition = new Vector2(hasContainer ? 1050f : 946f, -84f);
            craftingPanel.sizeDelta = new Vector2(hasContainer ? 838f : 942f, 900f);
        }

        private void RefreshAll()
        {
            if (root == null)
            {
                return;
            }

            UpdateLayout();
            RefreshInventory();
            RefreshCrafting();
            RefreshContainer();
        }

        private void RefreshInventory()
        {
            Inventory inventory = GameManager.Instance.PlayerInventory;
            int used = 0;
            for (int i = 0; i < playerSlots.Length; i++)
            {
                InventorySlot slot = inventory.GetSlot(i);
                if (slot == null || slot.IsEmpty)
                {
                    RuntimeUI.SetButtonText(playerSlots[i], (i < 6 ? (i + 1) + "\n" : string.Empty) + "EMPTY");
                    playerSlots[i].image.color = selectedSlot == i ? new Color(0.31f, 0.26f, 0.12f, 0.98f) : RuntimeUI.SlotEmpty;
                    continue;
                }

                used++;
                ItemDefinition item = ItemDatabase.Get(slot.itemId);
                string durability = item.IsDurable ? "\nDur " + slot.durability : string.Empty;
                string prefix = i < 6 ? (i + 1) + "\n" : string.Empty;
                RuntimeUI.SetButtonText(playerSlots[i], prefix + RuntimeUI.CategoryName(item.Category) + "\n" + item.DisplayName + "\nx" + slot.amount + durability);
                playerSlots[i].image.color = selectedSlot == i ? new Color(0.43f, 0.34f, 0.13f, 0.98f) : RuntimeUI.CategoryColor(item.Category);
            }

            inventoryInfo.text = "Sloty: " + used + " / 28";
        }

        private void RefreshCrafting()
        {
            IReadOnlyList<CraftingQueueItem> queue = GameManager.Instance.Crafting.Queue;
            for (int i = 0; i < queueButtons.Length; i++)
            {
                bool occupied = i < queue.Count;
                queueButtons[i].interactable = occupied;
                if (!occupied)
                {
                    RuntimeUI.SetButtonText(queueButtons[i], i == 0 ? "Fronta craftingu je prázdná." : "-");
                    continue;
                }

                CraftingQueueItem item = queue[i];
                float progress = 1f - Mathf.Clamp01(item.remaining / Mathf.Max(0.01f, item.total));
                RecipeDefinition recipe = CraftingDatabase.Get(item.recipeId);
                RuntimeUI.SetButtonText(queueButtons[i], (recipe == null ? item.recipeId : recipe.DisplayName) + "   " + Mathf.RoundToInt(progress * 100f) + "%   [zrušit]");
            }

            for (int i = 0; i < recipeButtons.Count; i++)
            {
                RecipeDefinition recipe = CraftingDatabase.All[i];
                bool canCraft = GameManager.Instance.Crafting.CanCraft(recipe);
                recipeButtons[i].interactable = canCraft;
                recipeButtons[i].image.color = canCraft ? RuntimeUI.CategoryColor(recipe.Category) : new Color(0.09f, 0.1f, 0.11f, 0.9f);
                RuntimeUI.SetButtonText(recipeButtons[i], RecipeLabel(recipe));
            }
        }

        private void RefreshContainer()
        {
            if (ActiveContainer == null)
            {
                return;
            }

            containerTitle.text = ActiveContainer.DisplayName.ToUpperInvariant();
            Inventory inventory = ActiveContainer.Inventory;
            for (int i = 0; i < containerSlots.Length; i++)
            {
                bool visible = i < inventory.Capacity;
                containerSlots[i].gameObject.SetActive(visible);
                if (!visible)
                {
                    continue;
                }

                InventorySlot slot = inventory.GetSlot(i);
                string prefix = FurnaceSlotName(i);
                if (slot == null || slot.IsEmpty)
                {
                    RuntimeUI.SetButtonText(containerSlots[i], (string.IsNullOrEmpty(prefix) ? "SLOT " + (i + 1) : prefix) + "\nEMPTY");
                    containerSlots[i].image.color = RuntimeUI.SlotEmpty;
                    continue;
                }

                ItemDefinition item = ItemDatabase.Get(slot.itemId);
                RuntimeUI.SetButtonText(containerSlots[i], prefix + "\n" + item.DisplayName + "\nx" + slot.amount);
                containerSlots[i].image.color = RuntimeUI.CategoryColor(item.Category);
            }

            Furnace furnace = ActiveContainer as Furnace;
            bool isFurnace = furnace != null;
            furnaceToggle.gameObject.SetActive(isFurnace);
            furnaceProgress.gameObject.SetActive(isFurnace);
            if (isFurnace)
            {
                RuntimeUI.SetButtonText(furnaceToggle, furnace.IsActive ? "TURN OFF" : "TURN ON");
                furnaceProgress.text = "SMELT " + Mathf.RoundToInt(furnace.Progress01 * 100f) + "%";
            }
        }

        private void HandlePlayerSlotClick(int index)
        {
            InventorySlot slot = GameManager.Instance.PlayerInventory.GetSlot(index);
            Keyboard keyboard = Keyboard.current;
            bool alt = keyboard != null && (keyboard.leftAltKey.isPressed || keyboard.rightAltKey.isPressed);
            bool shift = keyboard != null && (keyboard.leftShiftKey.isPressed || keyboard.rightShiftKey.isPressed);

            if (slot != null && !slot.IsEmpty && alt)
            {
                DropSlot(index, shift ? int.MaxValue : 1);
                return;
            }

            if (ActiveContainer != null && slot != null && !slot.IsEmpty && shift)
            {
                if (!ActiveContainer.CanDeposit)
                {
                    GameEvents.RaiseCenter("Items cannot be deposited into corpse loot");
                    return;
                }
                InventorySlot removed = GameManager.Instance.PlayerInventory.RemoveFromSlot(index, slot.amount);
                int remainder = ActiveContainer.Deposit(removed.itemId, removed.amount, removed.durability);
                if (remainder > 0) GameManager.Instance.PlayerInventory.Add(removed.itemId, remainder, removed.durability);
                return;
            }

            selectedSlot = index;
            RefreshInventory();
        }

        private void DropSelected(int amount)
        {
            if (selectedSlot >= 0)
            {
                DropSlot(selectedSlot, amount);
            }
        }

        private void DropSlot(int index, int amount)
        {
            InventorySlot slot = GameManager.Instance.PlayerInventory.GetSlot(index);
            if (slot == null || slot.IsEmpty)
            {
                return;
            }

            InventorySlot removed = GameManager.Instance.PlayerInventory.RemoveFromSlot(index, Mathf.Min(amount, slot.amount));
            Vector3 position = GameManager.Instance.PlayerController.transform.position + GameManager.Instance.PlayerController.transform.forward * 1.5f + Vector3.up;
            GameManager.Instance.Drops.Spawn(removed.itemId, removed.amount, position, removed.durability);
        }

        private void TransferContainerSlot(int index)
        {
            if (ActiveContainer == null)
            {
                return;
            }

            InventorySlot slot = ActiveContainer.Inventory.GetSlot(index);
            if (slot == null || slot.IsEmpty)
            {
                return;
            }

            InventorySlot removed = ActiveContainer.Inventory.RemoveFromSlot(index, slot.amount);
            int remainder = GameManager.Instance.PlayerInventory.Add(removed.itemId, removed.amount, removed.durability);
            if (remainder > 0) ActiveContainer.Inventory.AddToSlot(index, removed.itemId, remainder, removed.durability);
        }

        private void TakeAll()
        {
            if (ActiveContainer == null)
            {
                return;
            }

            for (int i = 0; i < ActiveContainer.Inventory.Capacity; i++)
            {
                TransferContainerSlot(i);
            }
        }

        private void DepositAll()
        {
            if (ActiveContainer == null)
            {
                return;
            }

            if (!ActiveContainer.CanDeposit)
            {
                GameEvents.RaiseCenter("Items cannot be deposited into corpse loot");
                return;
            }

            Inventory inventory = GameManager.Instance.PlayerInventory;
            for (int i = 6; i < inventory.Capacity; i++)
            {
                InventorySlot slot = inventory.GetSlot(i);
                if (slot == null || slot.IsEmpty) continue;
                InventorySlot removed = inventory.RemoveFromSlot(i, slot.amount);
                int remainder = ActiveContainer.Deposit(removed.itemId, removed.amount, removed.durability);
                if (remainder > 0) inventory.Add(removed.itemId, remainder, removed.durability);
            }
        }

        private void RestackInventory()
        {
            Inventory inventory = GameManager.Instance.PlayerInventory;
            List<InventorySlot> snapshot = inventory.CreateSnapshot();
            inventory.Clear();
            for (int i = 0; i < snapshot.Count; i++)
            {
                InventorySlot slot = snapshot[i];
                if (!slot.IsEmpty) inventory.Add(slot.itemId, slot.amount, slot.durability);
            }
        }

        private void QueueRecipe(RecipeDefinition recipe)
        {
            GameManager.Instance.Crafting.QueueCraft(recipe);
            RefreshAll();
        }

        private void ToggleFurnace()
        {
            Furnace furnace = ActiveContainer as Furnace;
            if (furnace != null)
            {
                furnace.ToggleActive();
                RefreshContainer();
            }
        }

        private void CloseContainer()
        {
            ActiveContainer = null;
            RefreshAll();
        }

        private string FurnaceSlotName(int index)
        {
            if (!(ActiveContainer is Furnace))
            {
                return string.Empty;
            }

            string[] names = { "INPUT A", "INPUT B", "FUEL", "OUTPUT A", "OUTPUT B", "OUTPUT C" };
            return index >= 0 && index < names.Length ? names[index] : string.Empty;
        }

        private static string RecipeLabel(RecipeDefinition recipe)
        {
            return RuntimeUI.CategoryName(recipe.Category) + "\n" + recipe.DisplayName + "\n" + CostText(recipe.Cost) +
                "   " + recipe.CraftTime.ToString("0.0") + "s" + (recipe.RequiredWorkbenchLevel > 0 ? "   WB" + recipe.RequiredWorkbenchLevel : string.Empty);
        }

        private static string CostText(IReadOnlyDictionary<string, int> cost)
        {
            List<string> parts = new List<string>();
            foreach (KeyValuePair<string, int> entry in cost)
            {
                parts.Add(entry.Key + " x" + entry.Value);
            }

            return string.Join(" | ", parts);
        }
    }
}
