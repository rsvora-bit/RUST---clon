using System;
using System.Collections.Generic;

namespace FarkensWorld
{
    [Serializable]
    public sealed class Inventory
    {
        private readonly List<InventorySlot> slots = new List<InventorySlot>();

        public event Action Changed;

        public int Capacity => slots.Count;
        public IReadOnlyList<InventorySlot> Slots => slots;

        public Inventory(int capacity)
        {
            Resize(capacity);
        }

        public InventorySlot GetSlot(int index)
        {
            return index >= 0 && index < slots.Count ? slots[index] : null;
        }

        public void Resize(int capacity)
        {
            while (slots.Count < capacity)
            {
                slots.Add(new InventorySlot());
            }

            if (slots.Count > capacity)
            {
                slots.RemoveRange(capacity, slots.Count - capacity);
            }
        }

        public int Count(string itemId)
        {
            int total = 0;
            for (int i = 0; i < slots.Count; i++)
            {
                if (!slots[i].IsEmpty && slots[i].itemId == itemId)
                {
                    total += slots[i].amount;
                }
            }

            return total;
        }

        public bool CanAdd(string itemId, int amount)
        {
            ItemDefinition definition = ItemDatabase.Get(itemId);
            if (definition == null || amount <= 0)
            {
                return false;
            }

            int room = 0;
            for (int i = 0; i < slots.Count; i++)
            {
                InventorySlot slot = slots[i];
                if (slot.IsEmpty)
                {
                    room += definition.StackLimit;
                }
                else if (slot.itemId == itemId && !definition.IsDurable)
                {
                    room += definition.StackLimit - slot.amount;
                }

                if (room >= amount)
                {
                    return true;
                }
            }

            return false;
        }

        public int Add(string itemId, int amount, int durability = -1)
        {
            ItemDefinition definition = ItemDatabase.Get(itemId);
            if (definition == null || amount <= 0)
            {
                return amount;
            }

            int remaining = amount;
            if (!definition.IsDurable)
            {
                for (int i = 0; i < slots.Count && remaining > 0; i++)
                {
                    InventorySlot slot = slots[i];
                    if (slot.IsEmpty || slot.itemId != itemId)
                    {
                        continue;
                    }

                    int moved = Math.Min(remaining, definition.StackLimit - slot.amount);
                    slot.amount += moved;
                    remaining -= moved;
                }
            }

            for (int i = 0; i < slots.Count && remaining > 0; i++)
            {
                InventorySlot slot = slots[i];
                if (!slot.IsEmpty)
                {
                    continue;
                }

                int moved = Math.Min(remaining, definition.StackLimit);
                slot.itemId = itemId;
                slot.amount = moved;
                slot.durability = definition.IsDurable
                    ? (durability >= 0 ? durability : definition.MaxDurability)
                    : 0;
                remaining -= moved;
            }

            NotifyChanged();
            return remaining;
        }

        public int AddToSlot(int index, string itemId, int amount, int durability = -1)
        {
            InventorySlot slot = GetSlot(index);
            ItemDefinition definition = ItemDatabase.Get(itemId);
            if (slot == null || definition == null || amount <= 0)
            {
                return amount;
            }

            if (!slot.IsEmpty && (slot.itemId != itemId || definition.IsDurable))
            {
                return amount;
            }

            int room = slot.IsEmpty ? definition.StackLimit : definition.StackLimit - slot.amount;
            int moved = Math.Min(room, amount);
            if (moved <= 0)
            {
                return amount;
            }

            if (slot.IsEmpty)
            {
                slot.itemId = itemId;
                slot.amount = moved;
                slot.durability = definition.IsDurable
                    ? (durability >= 0 ? durability : definition.MaxDurability)
                    : 0;
            }
            else
            {
                slot.amount += moved;
            }

            NotifyChanged();
            return amount - moved;
        }

        public bool Remove(string itemId, int amount)
        {
            if (Count(itemId) < amount || amount <= 0)
            {
                return false;
            }

            int remaining = amount;
            for (int i = slots.Count - 1; i >= 0 && remaining > 0; i--)
            {
                InventorySlot slot = slots[i];
                if (slot.IsEmpty || slot.itemId != itemId)
                {
                    continue;
                }

                int removed = Math.Min(remaining, slot.amount);
                slot.amount -= removed;
                remaining -= removed;
                if (slot.amount <= 0)
                {
                    slot.Clear();
                }
            }

            NotifyChanged();
            return true;
        }

        public InventorySlot RemoveFromSlot(int index, int amount)
        {
            InventorySlot slot = GetSlot(index);
            if (slot == null || slot.IsEmpty || amount <= 0)
            {
                return null;
            }

            int removed = Math.Min(amount, slot.amount);
            InventorySlot result = new InventorySlot(slot.itemId, removed, slot.durability);
            slot.amount -= removed;
            if (slot.amount <= 0)
            {
                slot.Clear();
            }

            NotifyChanged();
            return result;
        }

        public bool DamageSlot(int index, int amount)
        {
            InventorySlot slot = GetSlot(index);
            ItemDefinition definition = slot == null ? null : ItemDatabase.Get(slot.itemId);
            if (slot == null || slot.IsEmpty || definition == null || !definition.IsDurable)
            {
                return false;
            }

            slot.durability -= Math.Max(1, amount);
            if (slot.durability <= 0)
            {
                slot.Clear();
            }

            NotifyChanged();
            return true;
        }

        public void Clear()
        {
            for (int i = 0; i < slots.Count; i++)
            {
                slots[i].Clear();
            }

            NotifyChanged();
        }

        public void Sort()
        {
            List<InventorySlot> occupied = new List<InventorySlot>();
            for (int i = 0; i < slots.Count; i++)
            {
                if (!slots[i].IsEmpty)
                {
                    occupied.Add(slots[i].Clone());
                }
            }

            occupied.Sort((a, b) =>
            {
                ItemDefinition left = ItemDatabase.Get(a.itemId);
                ItemDefinition right = ItemDatabase.Get(b.itemId);
                int category = left.Category.CompareTo(right.Category);
                return category != 0 ? category : string.Compare(left.DisplayName, right.DisplayName, StringComparison.Ordinal);
            });

            for (int i = 0; i < slots.Count; i++)
            {
                slots[i].Clear();
            }

            for (int i = 0; i < occupied.Count && i < slots.Count; i++)
            {
                slots[i] = occupied[i];
            }

            NotifyChanged();
        }

        public List<InventorySlot> CreateSnapshot()
        {
            List<InventorySlot> snapshot = new List<InventorySlot>(slots.Count);
            for (int i = 0; i < slots.Count; i++)
            {
                snapshot.Add(slots[i].Clone());
            }

            return snapshot;
        }

        public void Restore(IList<InventorySlot> snapshot)
        {
            for (int i = 0; i < slots.Count; i++)
            {
                slots[i] = snapshot != null && i < snapshot.Count && snapshot[i] != null
                    ? snapshot[i].Clone()
                    : new InventorySlot();
            }

            NotifyChanged();
        }

        public void NotifyChanged()
        {
            Changed?.Invoke();
            GameEvents.RaiseInventoryChanged();
        }
    }
}
