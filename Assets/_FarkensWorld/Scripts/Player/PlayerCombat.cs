using UnityEngine;
using UnityEngine.InputSystem;

namespace FarkensWorld
{
    public sealed class PlayerCombat : MonoBehaviour
    {
        [SerializeField] private float hitDistance = 4.2f;
        [SerializeField] private float hitCooldown = 0.42f;

        private FirstPersonController controller;
        private float nextHitTime;

        private void Awake()
        {
            controller = GetComponent<FirstPersonController>();
        }

        private void Update()
        {
            GameManager game = GameManager.Instance;
            Mouse mouse = Mouse.current;
            if (game == null || mouse == null || game.GameplayInputBlocked || game.Building.IsPlacing)
            {
                return;
            }

            if (mouse.leftButton.wasPressedThisFrame && Time.time >= nextHitTime)
            {
                nextHitTime = Time.time + hitCooldown;
                TryHit();
            }
        }

        private void TryHit()
        {
            RaycastHit hit;
            Camera camera = controller.PlayerCamera;
            if (!Physics.Raycast(camera.transform.position, camera.transform.forward, out hit, hitDistance))
            {
                return;
            }

            ResourceNode resource = hit.collider.GetComponentInParent<ResourceNode>();
            if (resource != null)
            {
                InventorySlot toolSlot = GameManager.Instance.Hotbar.SelectedSlot;
                string toolId = toolSlot == null || toolSlot.IsEmpty ? string.Empty : toolSlot.itemId;
                resource.Harvest(toolId, GameManager.Instance.Drops);

                if (!string.IsNullOrEmpty(toolId))
                {
                    GameManager.Instance.PlayerInventory.DamageSlot(GameManager.Instance.Hotbar.SelectedIndex, 1);
                }

                return;
            }

            LootContainer loot = hit.collider.GetComponentInParent<LootContainer>();
            if (loot != null)
            {
                loot.Hit(18f);
            }
        }
    }
}
