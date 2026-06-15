using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    public sealed class WorldPopulation : MonoBehaviour
    {
        private readonly List<WorldActor> actors = new List<WorldActor>();
        private readonly Dictionary<WorldActorKind, Material> bodyMaterials = new Dictionary<WorldActorKind, Material>();
        private Transform populationRoot;
        private Material detailMaterial;

        public int ActiveCount
        {
            get
            {
                actors.RemoveAll(actor => actor == null);
                return actors.Count;
            }
        }

        public void Generate(int seed)
        {
            ClearAll();
            populationRoot = new GameObject("World Population - Seed " + seed).transform;
            populationRoot.SetParent(transform, false);
            EnsureMaterials();
            System.Random random = new System.Random(seed + 771);
            SpawnMany(WorldActorKind.Deer, 8, random);
            SpawnMany(WorldActorKind.Boar, 5, random);
            SpawnMany(WorldActorKind.Wolf, 4, random);
            SpawnMany(WorldActorKind.Scientist, 2, random);
        }

        public WorldActor Spawn(WorldActorKind kind, Vector3 position)
        {
            EnsureMaterials();
            if (populationRoot == null)
            {
                populationRoot = new GameObject("World Population").transform;
                populationRoot.SetParent(transform, false);
            }

            GameObject root = new GameObject(kind.ToString());
            root.transform.SetParent(populationRoot, false);
            position.y = SampleGround(position) + 0.03f;
            root.transform.position = position;
            WorldActor actor = root.AddComponent<WorldActor>();
            actor.Configure(this, kind, bodyMaterials[kind], detailMaterial);
            actors.Add(actor);
            return actor;
        }

        public int Kill(string selector)
        {
            string target = (selector ?? "all").ToLowerInvariant();
            int killed = 0;
            WorldActor[] snapshot = actors.ToArray();
            for (int i = 0; i < snapshot.Length; i++)
            {
                WorldActor actor = snapshot[i];
                if (actor == null) continue;
                if (target != "all" && target != "animals" && actor.Kind.ToString().ToLowerInvariant() != target) continue;
                if (target == "animals" && actor.Kind == WorldActorKind.Scientist) continue;
                actor.Damage(10000f, actor.transform.position, gameObject);
                killed++;
            }
            return killed;
        }

        public void ClearAll()
        {
            actors.Clear();
            if (populationRoot != null) Destroy(populationRoot.gameObject);
            foreach (CorpseContainer corpse in FindObjectsByType<CorpseContainer>())
            {
                Destroy(corpse.gameObject);
            }
            populationRoot = null;
        }

        public void NotifyActorDied(WorldActor actor)
        {
            actors.Remove(actor);
        }

        public int Count(WorldActorKind kind)
        {
            actors.RemoveAll(actor => actor == null);
            int count = 0;
            for (int i = 0; i < actors.Count; i++) if (actors[i].Kind == kind) count++;
            return count;
        }

        private void SpawnMany(WorldActorKind kind, int count, System.Random random)
        {
            for (int i = 0; i < count; i++)
            {
                float angle = (float)random.NextDouble() * Mathf.PI * 2f;
                float radius = kind == WorldActorKind.Scientist
                    ? 30f + (float)random.NextDouble() * 25f
                    : 16f + (float)random.NextDouble() * 48f;
                float x = kind == WorldActorKind.Scientist ? ((i & 1) == 0 ? 5.7f : -5.7f) : Mathf.Cos(angle) * radius;
                float z = Mathf.Sin(angle) * radius;
                Spawn(kind, new Vector3(x, 20f, z));
            }
        }

        private void EnsureMaterials()
        {
            if (bodyMaterials.Count > 0) return;
            bodyMaterials[WorldActorKind.Deer] = WorldGenerator.CreateMaterial("Deer Fur", new Color(0.46f, 0.29f, 0.13f), 0.96f);
            bodyMaterials[WorldActorKind.Boar] = WorldGenerator.CreateMaterial("Boar Fur", new Color(0.22f, 0.17f, 0.13f), 0.98f);
            bodyMaterials[WorldActorKind.Wolf] = WorldGenerator.CreateMaterial("Wolf Fur", new Color(0.32f, 0.35f, 0.34f), 0.96f);
            bodyMaterials[WorldActorKind.Scientist] = WorldGenerator.CreateMaterial("Scientist Suit", new Color(0.08f, 0.35f, 0.52f), 0.72f);
            detailMaterial = WorldGenerator.CreateMaterial("Actor Detail", new Color(0.075f, 0.065f, 0.055f), 0.9f);
        }

        private static float SampleGround(Vector3 position)
        {
            if (Physics.Raycast(new Vector3(position.x, 45f, position.z), Vector3.down, out RaycastHit hit, 90f, ~0, QueryTriggerInteraction.Ignore))
            {
                return hit.point.y;
            }
            return 0f;
        }
    }
}
