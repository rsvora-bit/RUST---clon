using System;

namespace FarkensWorld
{
    [Serializable]
    public sealed class InventorySlot
    {
        public string itemId;
        public int amount;
        public int durability;

        public bool IsEmpty => string.IsNullOrEmpty(itemId) || amount <= 0;

        public InventorySlot()
        {
            Clear();
        }

        public InventorySlot(string id, int itemAmount, int itemDurability = 0)
        {
            itemId = id;
            amount = itemAmount;
            durability = itemDurability;
        }

        public InventorySlot Clone()
        {
            return new InventorySlot(itemId, amount, durability);
        }

        public void Clear()
        {
            itemId = string.Empty;
            amount = 0;
            durability = 0;
        }
    }
}
