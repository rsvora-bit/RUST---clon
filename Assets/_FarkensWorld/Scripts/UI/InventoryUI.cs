using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    public sealed class InventoryUI : MonoBehaviour
    {
        private Vector2 recipeScroll;
        private int selectedSlot = -1;

        public bool IsOpen { get; private set; }
        public ContainerInventory ActiveContainer { get; private set; }

        public void Toggle()
        {
            if (IsOpen)
            {
                Close();
            }
            else
            {
                GameManager.Instance.BuildUI.Close();
                IsOpen = true;
            }
        }

        public void Close()
        {
            IsOpen = false;
            ActiveContainer = null;
            selectedSlot = -1;
        }

        public void OpenContainer(ContainerInventory container)
        {
            ActiveContainer = container;
            IsOpen = true;
            GameManager.Instance.BuildUI.Close();
        }

        private void OnGUI()
        {
            if (!IsOpen)
            {
                return;
            }

            GUI.Box(new Rect(24f, 24f, Screen.width - 48f, Screen.height - 48f), GUIContent.none);
            GUI.Label(new Rect(45f, 36f, 520f, 30f), "INVENTORY - 28 SLOTS / HOTBAR 1-6", HeaderStyle());
            DrawInventoryGrid();
            DrawInventoryActions();
            DrawCrafting();
            if (ActiveContainer != null)
            {
                DrawContainer();
            }
            GUI.Label(new Rect(45f, Screen.height - 76f, 650f, 24f), "Click selects | Alt-click drops 1 | Shift+Alt drops stack | Shift-click transfers", GUI.skin.label);
        }

        private void DrawInventoryGrid()
        {
            Inventory inventory = GameManager.Instance.PlayerInventory;
            float startX = 45f;
            float startY = 82f;
            for (int i = 0; i < inventory.Capacity; i++)
            {
                int row = i / 7;
                int column = i % 7;
                Rect rect = new Rect(startX + column * 92f, startY + row * 82f, 84f, 74f);
                InventorySlot slot = inventory.GetSlot(i);
                string label = SlotLabel(slot, i < 6 ? (i + 1).ToString() : string.Empty);
                Color old = GUI.color;
                GUI.color = selectedSlot == i ? new Color(1f, 0.78f, 0.28f) : Color.white;
                bool clicked = GUI.Button(rect, label);
                GUI.color = old;
                if (clicked)
                {
                    HandlePlayerSlotClick(i, slot);
                }
            }
        }

        private void DrawInventoryActions()
        {
            float y = 430f;
            if (GUI.Button(new Rect(45f, y, 120f, 34f), "Drop 1")) DropSelected(1);
            if (GUI.Button(new Rect(175f, y, 130f, 34f), "Drop Stack")) DropSelected(int.MaxValue);
            if (GUI.Button(new Rect(315f, y, 120f, 34f), "Sort")) GameManager.Instance.PlayerInventory.Sort();
            if (GUI.Button(new Rect(445f, y, 120f, 34f), "Stack All")) RestackInventory();
        }

        private void DrawCrafting()
        {
            float x = ActiveContainer == null ? Screen.width - 500f : Screen.width - 760f;
            float width = ActiveContainer == null ? 450f : 330f;
            GUI.Box(new Rect(x, 70f, width, Screen.height - 150f), GUIContent.none);
            GUI.Label(new Rect(x + 18f, 82f, width - 36f, 28f), "CRAFTING QUEUE", HeaderStyle());

            IReadOnlyList<CraftingQueueItem> queue = GameManager.Instance.Crafting.Queue;
            float queueY = 116f;
            for (int i = 0; i < queue.Count && i < 3; i++)
            {
                CraftingQueueItem item = queue[i];
                float progress = 1f - Mathf.Clamp01(item.remaining / item.total);
                GUI.Label(new Rect(x + 18f, queueY, width - 100f, 24f), item.recipeId + " " + Mathf.RoundToInt(progress * 100f) + "%");
                if (GUI.Button(new Rect(x + width - 82f, queueY, 64f, 24f), "Cancel")) GameManager.Instance.Crafting.Cancel(i);
                queueY += 28f;
            }

            Rect scrollRect = new Rect(x + 12f, queueY + 8f, width - 24f, Screen.height - queueY - 180f);
            Rect viewRect = new Rect(0f, 0f, width - 48f, CraftingDatabase.All.Count * 58f);
            recipeScroll = GUI.BeginScrollView(scrollRect, recipeScroll, viewRect);
            for (int i = 0; i < CraftingDatabase.All.Count; i++)
            {
                RecipeDefinition recipe = CraftingDatabase.All[i];
                string cost = CostText(recipe.Cost);
                bool canCraft = GameManager.Instance.Crafting.CanCraft(recipe);
                GUI.enabled = canCraft;
                if (GUI.Button(new Rect(0f, i * 58f, width - 60f, 50f), recipe.DisplayName + "\n" + cost + (recipe.RequiredWorkbenchLevel > 0 ? " | WB" + recipe.RequiredWorkbenchLevel : string.Empty)))
                {
                    GameManager.Instance.Crafting.QueueCraft(recipe);
                }
                GUI.enabled = true;
            }
            GUI.EndScrollView();
        }

        private void DrawContainer()
        {
            float x = 710f;
            float y = 70f;
            float width = 300f;
            GUI.Box(new Rect(x, y, width, 360f), GUIContent.none);
            GUI.Label(new Rect(x + 15f, y + 12f, width - 30f, 28f), ActiveContainer.DisplayName.ToUpperInvariant(), HeaderStyle());

            Inventory container = ActiveContainer.Inventory;
            for (int i = 0; i < container.Capacity; i++)
            {
                int row = i / 3;
                int column = i % 3;
                Rect rect = new Rect(x + 15f + column * 92f, y + 52f + row * 76f, 84f, 68f);
                InventorySlot slot = container.GetSlot(i);
                if (GUI.Button(rect, SlotLabel(slot, FurnaceSlotName(i))))
                {
                    TransferContainerSlot(i);
                }
            }

            float buttonsY = y + 300f;
            if (GUI.Button(new Rect(x + 15f, buttonsY, 82f, 32f), "Take All")) TakeAll();
            if (GUI.Button(new Rect(x + 105f, buttonsY, 92f, 32f), "Deposit")) DepositAll();
            if (GUI.Button(new Rect(x + 205f, buttonsY, 80f, 32f), "Close")) Close();

            Furnace furnace = ActiveContainer as Furnace;
            if (furnace != null)
            {
                string button = furnace.IsActive ? "Stop furnace" : "Start furnace";
                if (GUI.Button(new Rect(x + 15f, buttonsY + 38f, 180f, 32f), button)) furnace.ToggleActive();
                GUI.Label(new Rect(x + 205f, buttonsY + 42f, 80f, 24f), Mathf.RoundToInt(furnace.Progress01 * 100f) + "%");
            }
        }

        private void HandlePlayerSlotClick(int index, InventorySlot slot)
        {
            Event current = Event.current;
            if (slot != null && !slot.IsEmpty && current.alt)
            {
                DropSlot(index, current.shift ? int.MaxValue : 1);
                return;
            }

            if (ActiveContainer != null && slot != null && !slot.IsEmpty && current.shift)
            {
                InventorySlot removed = GameManager.Instance.PlayerInventory.RemoveFromSlot(index, slot.amount);
                int remainder = ActiveContainer.Deposit(removed.itemId, removed.amount, removed.durability);
                if (remainder > 0) GameManager.Instance.PlayerInventory.Add(removed.itemId, remainder, removed.durability);
                return;
            }

            selectedSlot = index;
        }

        private void DropSelected(int amount)
        {
            if (selectedSlot >= 0) DropSlot(selectedSlot, amount);
        }

        private void DropSlot(int index, int amount)
        {
            InventorySlot slot = GameManager.Instance.PlayerInventory.GetSlot(index);
            if (slot == null || slot.IsEmpty) return;
            InventorySlot removed = GameManager.Instance.PlayerInventory.RemoveFromSlot(index, Mathf.Min(amount, slot.amount));
            Vector3 position = GameManager.Instance.PlayerController.transform.position + GameManager.Instance.PlayerController.transform.forward * 1.5f + Vector3.up;
            GameManager.Instance.Drops.Spawn(removed.itemId, removed.amount, position, removed.durability);
        }

        private void TransferContainerSlot(int index)
        {
            InventorySlot slot = ActiveContainer.Inventory.GetSlot(index);
            if (slot == null || slot.IsEmpty) return;
            InventorySlot removed = ActiveContainer.Inventory.RemoveFromSlot(index, slot.amount);
            int remainder = GameManager.Instance.PlayerInventory.Add(removed.itemId, removed.amount, removed.durability);
            if (remainder > 0) ActiveContainer.Inventory.AddToSlot(index, removed.itemId, remainder, removed.durability);
        }

        private void TakeAll()
        {
            for (int i = 0; i < ActiveContainer.Inventory.Capacity; i++) TransferContainerSlot(i);
        }

        private void DepositAll()
        {
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

        private static void RestackInventory()
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

        private static string SlotLabel(InventorySlot slot, string prefix)
        {
            if (slot == null || slot.IsEmpty) return string.IsNullOrEmpty(prefix) ? "EMPTY" : prefix + "\nEMPTY";
            ItemDefinition item = ItemDatabase.Get(slot.itemId);
            string label = (string.IsNullOrEmpty(prefix) ? string.Empty : prefix + "\n") + item.ShortName + "\nx" + slot.amount;
            return item.IsDurable ? label + "  " + slot.durability : label;
        }

        private string FurnaceSlotName(int index)
        {
            if (!(ActiveContainer is Furnace)) return string.Empty;
            string[] names = { "INPUT A", "INPUT B", "FUEL", "OUTPUT A", "OUTPUT B", "OUTPUT C" };
            return index >= 0 && index < names.Length ? names[index] : string.Empty;
        }

        private static string CostText(IReadOnlyDictionary<string, int> cost)
        {
            List<string> parts = new List<string>();
            foreach (KeyValuePair<string, int> entry in cost) parts.Add(entry.Key + " " + entry.Value);
            return string.Join(" | ", parts);
        }

        private static GUIStyle HeaderStyle()
        {
            GUIStyle style = new GUIStyle(GUI.skin.label) { fontSize = 19, fontStyle = FontStyle.Bold };
            style.normal.textColor = new Color(0.95f, 0.77f, 0.28f);
            return style;
        }
    }
}
