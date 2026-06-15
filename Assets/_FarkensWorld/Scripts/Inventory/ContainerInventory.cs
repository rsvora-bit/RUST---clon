using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    public class ContainerInventory : MonoBehaviour, IInteractable
    {
        [SerializeField] private string displayName = "Storage Box";
        [SerializeField] private int capacity = 12;

        protected Inventory inventory;

        public string DisplayName => displayName;
        public Inventory Inventory => inventory;
        public virtual bool CanDeposit => true;
        public virtual string InteractionPrompt => "E - open " + displayName;

        protected virtual void Awake()
        {
            inventory = new Inventory(capacity);
        }

        public void Configure(string containerName, int slotCount)
        {
            displayName = containerName;
            capacity = slotCount;
            inventory = new Inventory(capacity);
        }

        public virtual int Deposit(string itemId, int amount, int durability = 0)
        {
            if (!CanDeposit) return amount;
            return inventory.Add(itemId, amount, durability);
        }

        public virtual void Interact(PlayerInteraction player)
        {
            GameManager.Instance.InventoryUI.OpenContainer(this);
        }

        public List<InventorySlot> CreateSnapshot()
        {
            return inventory.CreateSnapshot();
        }

        public void Restore(IList<InventorySlot> slots)
        {
            inventory.Restore(slots);
        }

        public void DropContents()
        {
            for (int i = 0; i < inventory.Capacity; i++)
            {
                InventorySlot slot = inventory.GetSlot(i);
                if (slot != null && !slot.IsEmpty)
                {
                    GameManager.Instance.Drops.Spawn(slot.itemId, slot.amount, transform.position + Vector3.up + Random.insideUnitSphere * 0.5f, slot.durability);
                }
            }

            inventory.Clear();
        }
    }
}
