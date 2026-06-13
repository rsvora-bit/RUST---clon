using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    public sealed class DroppedItemWorldSpawner : MonoBehaviour
    {
        private readonly List<DroppedItem> activeDrops = new List<DroppedItem>();

        public int ActiveCount
        {
            get
            {
                activeDrops.RemoveAll(item => item == null);
                return activeDrops.Count;
            }
        }

        public DroppedItem Spawn(string itemId, int amount, Vector3 position, int durability = 0)
        {
            ItemDefinition definition = ItemDatabase.Get(itemId);
            if (definition == null || amount <= 0)
            {
                return null;
            }

            PrimitiveType shape = definition.Category == ItemCategory.Resources ? PrimitiveType.Sphere : PrimitiveType.Cube;
            GameObject dropObject = GameObject.CreatePrimitive(shape);
            dropObject.transform.position = position;
            dropObject.transform.localScale = shape == PrimitiveType.Sphere
                ? new Vector3(0.42f, 0.32f, 0.42f)
                : new Vector3(0.38f, 0.24f, 0.52f);

            Renderer renderer = dropObject.GetComponent<Renderer>();
            renderer.sharedMaterial = WorldGenerator.CreateMaterial("Drop " + itemId, definition.WorldColor, 0.65f);

            Rigidbody body = dropObject.AddComponent<Rigidbody>();
            body.mass = 0.3f;
            body.linearDamping = 1.5f;
            body.angularDamping = 1.5f;
            body.AddForce(new Vector3(Random.Range(-1.4f, 1.4f), 2.2f, Random.Range(-1.4f, 1.4f)), ForceMode.Impulse);

            DroppedItem droppedItem = dropObject.AddComponent<DroppedItem>();
            droppedItem.Initialize(itemId, amount, durability);
            activeDrops.Add(droppedItem);
            return droppedItem;
        }

        public void ClearAll()
        {
            for (int i = 0; i < activeDrops.Count; i++)
            {
                if (activeDrops[i] != null)
                {
                    Destroy(activeDrops[i].gameObject);
                }
            }

            activeDrops.Clear();
        }

        public List<DroppedItem> GetActiveDrops()
        {
            activeDrops.RemoveAll(item => item == null);
            return new List<DroppedItem>(activeDrops);
        }
    }
}
