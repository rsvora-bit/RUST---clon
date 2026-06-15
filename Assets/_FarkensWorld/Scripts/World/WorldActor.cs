using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    public enum WorldActorKind
    {
        Deer,
        Boar,
        Wolf,
        Scientist
    }

    public sealed class WorldActor : MonoBehaviour, IDamageable
    {
        private WorldPopulation owner;
        private WorldActorKind kind;
        private float health;
        private float speed;
        private float noticeRange;
        private float attackRange;
        private float attackDamage;
        private float nextAttack;
        private float nextWander;
        private Vector3 wanderTarget;
        private bool provoked;
        private Material corpseMaterial;

        public WorldActorKind Kind => kind;
        public bool IsAlive => health > 0f;

        public void Configure(WorldPopulation population, WorldActorKind actorKind, Material bodyMaterial, Material detailMaterial)
        {
            owner = population;
            kind = actorKind;
            corpseMaterial = bodyMaterial;
            health = actorKind == WorldActorKind.Deer ? 70f : actorKind == WorldActorKind.Boar ? 105f : actorKind == WorldActorKind.Wolf ? 85f : 125f;
            speed = actorKind == WorldActorKind.Deer ? 4.6f : actorKind == WorldActorKind.Boar ? 3.5f : actorKind == WorldActorKind.Wolf ? 4.2f : 3.1f;
            noticeRange = actorKind == WorldActorKind.Deer ? 12f : actorKind == WorldActorKind.Boar ? 10f : actorKind == WorldActorKind.Wolf ? 20f : 27f;
            attackRange = actorKind == WorldActorKind.Scientist ? 8f : 1.8f;
            attackDamage = actorKind == WorldActorKind.Boar ? 12f : actorKind == WorldActorKind.Wolf ? 15f : actorKind == WorldActorKind.Scientist ? 11f : 0f;

            CapsuleCollider collider = gameObject.AddComponent<CapsuleCollider>();
            collider.center = new Vector3(0f, actorKind == WorldActorKind.Scientist ? 1f : 0.8f, 0f);
            collider.height = actorKind == WorldActorKind.Scientist ? 2f : 1.55f;
            collider.radius = actorKind == WorldActorKind.Scientist ? 0.42f : 0.58f;
            BuildVisual(bodyMaterial, detailMaterial);
            PickWanderTarget();
        }

        private void Update()
        {
            if (!IsAlive || GameManager.Instance == null || GameManager.Instance.IsDead)
            {
                return;
            }

            Transform player = GameManager.Instance.PlayerController.transform;
            Vector3 toPlayer = player.position - transform.position;
            toPlayer.y = 0f;
            float distance = toPlayer.magnitude;
            bool aggressive = kind == WorldActorKind.Wolf || kind == WorldActorKind.Scientist || (kind == WorldActorKind.Boar && provoked);

            if (kind == WorldActorKind.Deer && distance < noticeRange)
            {
                Move(transform.position - toPlayer.normalized * 8f);
                return;
            }

            if (aggressive && distance < noticeRange)
            {
                if (distance <= attackRange)
                {
                    AttackPlayer();
                }
                else
                {
                    Move(player.position);
                }
                return;
            }

            if (Time.time >= nextWander || Vector3.Distance(transform.position, wanderTarget) < 1.5f)
            {
                PickWanderTarget();
            }
            Move(wanderTarget, 0.48f);
        }

        public void Damage(float amount, Vector3 hitPoint, GameObject source)
        {
            if (!IsAlive) return;
            health -= Mathf.Max(0f, amount);
            provoked = true;
            GameEvents.RaiseFeed(kind + " hit: " + Mathf.Max(0, Mathf.CeilToInt(health)) + " HP");
            if (health <= 0f)
            {
                Die();
            }
        }

        private void AttackPlayer()
        {
            if (Time.time < nextAttack) return;
            nextAttack = Time.time + (kind == WorldActorKind.Scientist ? 1.3f : 1.05f);
            PlayerStats stats = GameManager.Instance.PlayerStats;
            stats.Damage(attackDamage);
            if (kind == WorldActorKind.Wolf || kind == WorldActorKind.Boar) stats.AddBleeding(kind == WorldActorKind.Wolf ? 7f : 4f);
            GameEvents.RaiseCenter(kind + " hit you for " + Mathf.RoundToInt(attackDamage));
        }

        private void Move(Vector3 target, float multiplier = 1f)
        {
            Vector3 direction = target - transform.position;
            direction.y = 0f;
            if (direction.sqrMagnitude < 0.1f) return;
            direction.Normalize();
            Vector3 next = transform.position + direction * speed * multiplier * Time.deltaTime;
            if (next.magnitude > 69f) next = next.normalized * 69f;
            next.y = FindGround(next) + 0.03f;
            transform.position = next;
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(direction), Time.deltaTime * 7f);
        }

        private float FindGround(Vector3 position)
        {
            RaycastHit[] hits = Physics.RaycastAll(position + Vector3.up * 30f, Vector3.down, 70f, ~0, QueryTriggerInteraction.Ignore);
            float best = 0f;
            bool found = false;
            for (int i = 0; i < hits.Length; i++)
            {
                if (hits[i].transform.IsChildOf(transform)) continue;
                if (!found || hits[i].point.y > best)
                {
                    best = hits[i].point.y;
                    found = true;
                }
            }
            return found ? best : 0f;
        }

        private void PickWanderTarget()
        {
            Vector2 circle = Random.insideUnitCircle * Random.Range(5f, 14f);
            wanderTarget = transform.position + new Vector3(circle.x, 0f, circle.y);
            if (wanderTarget.magnitude > 67f) wanderTarget = wanderTarget.normalized * 67f;
            nextWander = Time.time + Random.Range(3f, 8f);
        }

        private void Die()
        {
            List<InventorySlot> loot = new List<InventorySlot>();
            if (kind == WorldActorKind.Deer)
            {
                loot.Add(new InventorySlot("cookedMeat", Random.Range(2, 5)));
                loot.Add(new InventorySlot("leather", Random.Range(8, 16)));
                loot.Add(new InventorySlot("animalFat", Random.Range(4, 10)));
            }
            else if (kind == WorldActorKind.Boar || kind == WorldActorKind.Wolf)
            {
                loot.Add(new InventorySlot("cookedMeat", Random.Range(3, 7)));
                loot.Add(new InventorySlot("leather", Random.Range(5, 13)));
                loot.Add(new InventorySlot("animalFat", Random.Range(7, 15)));
            }
            else
            {
                loot.Add(new InventorySlot("scrap", Random.Range(14, 35)));
                loot.Add(new InventorySlot("metalFragments", Random.Range(20, 55)));
                loot.Add(new InventorySlot("bandage", Random.Range(1, 3)));
                if (Random.value > 0.45f) loot.Add(new InventorySlot("metalPipe", 1));
                if (Random.value > 0.65f) loot.Add(new InventorySlot("gears", 1));
            }

            CorpseContainer.Create(kind.ToString(), transform.position, loot, corpseMaterial);
            GameEvents.RaiseCenter(kind + " died - corpse loot available");
            owner.NotifyActorDied(this);
            Destroy(gameObject);
        }

        private void BuildVisual(Material bodyMaterial, Material detailMaterial)
        {
            bool human = kind == WorldActorKind.Scientist;
            if (human)
            {
                CreatePart("Torso", PrimitiveType.Capsule, new Vector3(0f, 1.05f, 0f), new Vector3(0.7f, 0.82f, 0.48f), bodyMaterial);
                CreatePart("Head", PrimitiveType.Sphere, new Vector3(0f, 2f, 0f), Vector3.one * 0.43f, detailMaterial);
                CreatePart("Weapon", PrimitiveType.Cube, new Vector3(0.42f, 1.15f, 0.25f), new Vector3(0.12f, 0.12f, 0.95f), detailMaterial);
                return;
            }

            float bodyScale = kind == WorldActorKind.Deer ? 1f : kind == WorldActorKind.Boar ? 1.08f : 0.86f;
            CreatePart("Body", PrimitiveType.Capsule, new Vector3(0f, 0.92f, 0f), new Vector3(0.76f, 0.85f, 1.18f) * bodyScale, bodyMaterial, new Vector3(90f, 0f, 0f));
            CreatePart("Head", PrimitiveType.Sphere, new Vector3(0f, 1.08f, 0.94f * bodyScale), Vector3.one * 0.52f * bodyScale, detailMaterial);
            for (int i = 0; i < 4; i++)
            {
                float x = i % 2 == 0 ? -0.38f : 0.38f;
                float z = i < 2 ? -0.52f : 0.52f;
                CreatePart("Leg", PrimitiveType.Cylinder, new Vector3(x, 0.34f, z), new Vector3(0.16f, 0.42f, 0.16f), detailMaterial);
            }
        }

        private void CreatePart(string partName, PrimitiveType type, Vector3 localPosition, Vector3 localScale, Material material, Vector3? rotation = null)
        {
            GameObject part = WorldGenerator.Primitive(partName, type, localPosition, localScale, material, transform);
            if (rotation.HasValue) part.transform.localRotation = Quaternion.Euler(rotation.Value);
            Collider partCollider = part.GetComponent<Collider>();
            if (partCollider != null) Destroy(partCollider);
        }
    }
}
