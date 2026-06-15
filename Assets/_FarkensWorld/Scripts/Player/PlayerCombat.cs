using System.Collections.Generic;
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
        private readonly Stack<ArrowProjectile> arrowPool = new Stack<ArrowProjectile>();
        private readonly List<ArrowProjectile> activeArrows = new List<ArrowProjectile>();
        private Material arrowMaterial;

        public int ActiveProjectileCount => activeArrows.Count;

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
                InventorySlot selected = game.Hotbar.SelectedSlot;
                if (selected != null && !selected.IsEmpty && selected.itemId == "bow")
                {
                    nextHitTime = Time.time + 0.65f;
                    ShootBow();
                }
                else
                {
                    nextHitTime = Time.time + hitCooldown;
                    TryHit();
                }
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

            IDamageable damageable = FindDamageable(hit.collider);
            if (damageable != null && damageable.IsAlive)
            {
                InventorySlot weaponSlot = GameManager.Instance.Hotbar.SelectedSlot;
                string weaponId = weaponSlot == null || weaponSlot.IsEmpty ? string.Empty : weaponSlot.itemId;
                float damage = weaponId == "spear" ? 32f : weaponId == "hatchet" ? 20f : weaponId == "pickaxe" ? 18f : 10f;
                damageable.Damage(damage, hit.point, gameObject);
                GameManager.Instance.Audio.Play(AudioCue.Hit, Random.Range(0.9f, 1.08f));
                if (!string.IsNullOrEmpty(weaponId)) GameManager.Instance.PlayerInventory.DamageSlot(GameManager.Instance.Hotbar.SelectedIndex, 1);
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

        private void ShootBow()
        {
            GameManager game = GameManager.Instance;
            if (!game.PlayerInventory.Remove("arrow", 1))
            {
                GameEvents.RaiseCenter("No arrows in inventory");
                return;
            }

            ArrowProjectile arrow = arrowPool.Count > 0 ? arrowPool.Pop() : CreateArrow();
            activeArrows.Add(arrow);
            Camera camera = controller.PlayerCamera;
            Vector3 direction = (camera.transform.forward + Vector3.up * 0.012f).normalized;
            arrow.Launch(this, camera.transform.position + direction * 0.75f, direction, 42f);
            game.PlayerInventory.DamageSlot(game.Hotbar.SelectedIndex, 1);
            game.Audio.Play(AudioCue.BowShoot, Random.Range(0.94f, 1.04f));
            GameEvents.RaiseFeed("Bow fired");
        }

        public void RecycleArrow(ArrowProjectile arrow)
        {
            if (arrow == null || !activeArrows.Remove(arrow)) return;
            arrow.PrepareForPool();
            arrow.transform.SetParent(transform, false);
            arrowPool.Push(arrow);
        }

        private ArrowProjectile CreateArrow()
        {
            GameObject arrowObject = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            arrowObject.name = "Pooled Arrow Projectile";
            arrowObject.transform.localScale = new Vector3(0.055f, 0.72f, 0.055f);
            if (arrowMaterial == null)
            {
                arrowMaterial = WorldGenerator.CreateMaterial("Arrow", new Color(0.32f, 0.2f, 0.08f), 0.88f);
            }
            arrowObject.GetComponent<Renderer>().sharedMaterial = arrowMaterial;
            Rigidbody body = arrowObject.AddComponent<Rigidbody>();
            body.mass = 0.08f;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            body.interpolation = RigidbodyInterpolation.Interpolate;
            ArrowProjectile arrow = arrowObject.AddComponent<ArrowProjectile>();
            Collider playerCollider = GetComponent<Collider>();
            if (playerCollider != null) Physics.IgnoreCollision(arrowObject.GetComponent<Collider>(), playerCollider, true);
            arrow.PrepareForPool();
            return arrow;
        }

        private static IDamageable FindDamageable(Collider collider)
        {
            MonoBehaviour[] behaviours = collider.GetComponentsInParent<MonoBehaviour>();
            for (int i = 0; i < behaviours.Length; i++)
            {
                if (behaviours[i] is IDamageable damageable) return damageable;
            }
            return null;
        }
    }
}
