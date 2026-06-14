using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    public sealed class DroppedItemWorldSpawner : MonoBehaviour
    {
        private readonly List<DroppedItem> activeDrops = new List<DroppedItem>();
        private readonly Stack<DroppedItem> pool = new Stack<DroppedItem>();
        private readonly Dictionary<string, Material> materials = new Dictionary<string, Material>();

        public int ActiveCount => activeDrops.Count;

        public DroppedItem Spawn(string itemId, int amount, Vector3 position, int durability = 0)
        {
            ItemDefinition definition = ItemDatabase.Get(itemId);
            if (definition == null || amount <= 0)
            {
                return null;
            }

            DroppedItem droppedItem = pool.Count > 0 ? pool.Pop() : CreatePooledDrop();
            GameObject dropObject = droppedItem.gameObject;
            dropObject.SetActive(true);
            dropObject.transform.SetPositionAndRotation(position, Random.rotation);
            dropObject.transform.localScale = definition.Category == ItemCategory.Resources
                ? new Vector3(0.42f, 0.32f, 0.42f)
                : new Vector3(0.38f, 0.24f, 0.52f);

            Renderer renderer = dropObject.GetComponent<Renderer>();
            renderer.sharedMaterial = GetMaterial(itemId, definition);

            Rigidbody body = dropObject.GetComponent<Rigidbody>();
            body.linearVelocity = Vector3.zero;
            body.angularVelocity = Vector3.zero;
            body.AddForce(new Vector3(Random.Range(-1.4f, 1.4f), 2.2f, Random.Range(-1.4f, 1.4f)), ForceMode.Impulse);

            droppedItem.Initialize(itemId, amount, durability, this);
            activeDrops.Add(droppedItem);
            return droppedItem;
        }

        public void Recycle(DroppedItem droppedItem)
        {
            if (droppedItem == null || !droppedItem.gameObject.activeSelf)
            {
                return;
            }

            activeDrops.Remove(droppedItem);
            Rigidbody body = droppedItem.GetComponent<Rigidbody>();
            body.linearVelocity = Vector3.zero;
            body.angularVelocity = Vector3.zero;
            droppedItem.gameObject.SetActive(false);
            droppedItem.transform.SetParent(transform, false);
            pool.Push(droppedItem);
        }

        public void ClearAll()
        {
            for (int i = activeDrops.Count - 1; i >= 0; i--)
            {
                Recycle(activeDrops[i]);
            }
        }

        public List<DroppedItem> GetActiveDrops()
        {
            return new List<DroppedItem>(activeDrops);
        }

        private DroppedItem CreatePooledDrop()
        {
            GameObject dropObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
            dropObject.name = "Pooled Dropped Item";
            dropObject.transform.SetParent(transform, false);
            Rigidbody body = dropObject.AddComponent<Rigidbody>();
            body.mass = 0.3f;
            body.linearDamping = 1.5f;
            body.angularDamping = 1.5f;
            return dropObject.AddComponent<DroppedItem>();
        }

        private Material GetMaterial(string itemId, ItemDefinition definition)
        {
            if (!materials.TryGetValue(itemId, out Material material))
            {
                material = WorldGenerator.CreateMaterial("Drop " + itemId, definition.WorldColor, 0.65f);
                materials[itemId] = material;
            }

            return material;
        }
    }
}
