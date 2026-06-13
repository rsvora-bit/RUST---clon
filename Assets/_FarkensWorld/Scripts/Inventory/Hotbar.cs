using UnityEngine;

namespace FarkensWorld
{
    public sealed class Hotbar
    {
        public const int SlotCount = 6;

        private readonly Inventory inventory;
        private int selectedIndex;

        public int SelectedIndex => selectedIndex;
        public InventorySlot SelectedSlot => inventory.GetSlot(selectedIndex);

        public Hotbar(Inventory playerInventory)
        {
            inventory = playerInventory;
        }

        public void Select(int index)
        {
            selectedIndex = Mathf.Clamp(index, 0, SlotCount - 1);
            GameEvents.RaiseHotbarChanged();
        }

        public void RestoreSelection(int index)
        {
            Select(index);
        }
    }
}
