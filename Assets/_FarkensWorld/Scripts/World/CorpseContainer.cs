using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    public sealed class CorpseContainer : ContainerInventory
    {
        private float expiresAt;
        private float emptySince = -1f;

        public override string InteractionPrompt => "E - open corpse loot";
        public override bool CanDeposit => false;

        public static CorpseContainer Create(string corpseName, Vector3 position, IEnumerable<InventorySlot> loot, Material material)
        {
            GameObject root = new GameObject(corpseName + " Corpse");
            root.transform.position = position;
            GameObject body = WorldGenerator.Primitive("Corpse Body", PrimitiveType.Capsule, new Vector3(0f, 0.35f, 0f),
                new Vector3(0.65f, 0.42f, 0.65f), material, root.transform);
            body.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
            CorpseContainer corpse = root.AddComponent<CorpseContainer>();
            corpse.Configure(corpseName + " corpse", 12);
            foreach (InventorySlot slot in loot)
            {
                if (slot != null && !slot.IsEmpty) corpse.Deposit(slot.itemId, slot.amount, slot.durability);
            }
            corpse.expiresAt = Time.time + 240f;
            return corpse;
        }

        private void Update()
        {
            bool empty = inventory == null || IsEmpty(inventory);
            if (empty && emptySince < 0f) emptySince = Time.time;
            if (!empty) emptySince = -1f;
            if (Time.time >= expiresAt || (emptySince > 0f && Time.time - emptySince > 2f))
            {
                if (GameManager.Instance != null && GameManager.Instance.InventoryUI.ActiveContainer == this)
                {
                    GameManager.Instance.InventoryUI.Close();
                }
                Destroy(gameObject);
            }
        }

        private static bool IsEmpty(Inventory target)
        {
            for (int i = 0; i < target.Capacity; i++)
            {
                if (!target.GetSlot(i).IsEmpty) return false;
            }
            return true;
        }
    }
}
