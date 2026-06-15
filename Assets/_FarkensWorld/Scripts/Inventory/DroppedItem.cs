using UnityEngine;

namespace FarkensWorld
{
    public sealed class DroppedItem : MonoBehaviour, IInteractable
    {
        [SerializeField] private string itemId;
        [SerializeField] private int amount;
        [SerializeField] private int durability;
        [SerializeField] private float despawnAt;
        private DroppedItemWorldSpawner owner;

        public string ItemId => itemId;
        public int Amount => amount;
        public int Durability => durability;
        public string InteractionPrompt
        {
            get
            {
                ItemDefinition definition = ItemDatabase.Get(itemId);
                string name = definition == null ? itemId : definition.DisplayName;
                return "E - pick up " + name + " x" + amount;
            }
        }

        public void Initialize(string id, int itemAmount, int itemDurability, DroppedItemWorldSpawner worldSpawner)
        {
            itemId = id;
            amount = itemAmount;
            durability = itemDurability;
            owner = worldSpawner;
            despawnAt = Time.time + 300f;
            gameObject.name = "Dropped " + id + " x" + amount;
        }

        private void Update()
        {
            transform.Rotate(Vector3.up, 30f * Time.deltaTime, Space.World);
            if (Time.time >= despawnAt)
            {
                owner.Recycle(this);
            }
        }

        public void Interact(PlayerInteraction player)
        {
            Inventory inventory = GameManager.Instance.PlayerInventory;
            int remainder = inventory.Add(itemId, amount, durability);
            int pickedUp = amount - remainder;
            if (pickedUp > 0)
            {
                GameEvents.RaiseFeed("Picked up " + itemId + " x" + pickedUp);
                GameManager.Instance.Audio.Play(AudioCue.Pickup, Random.Range(0.95f, 1.1f));
                amount = remainder;
            }

            if (amount <= 0)
            {
                owner.Recycle(this);
            }
        }
    }
}
