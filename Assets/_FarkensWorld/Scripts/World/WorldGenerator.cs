using System;
using UnityEngine;
using Object = UnityEngine.Object;

namespace FarkensWorld
{
    public sealed class WorldGenerator : MonoBehaviour
    {
        private Transform worldRoot;
        private Material grass;
        private Material sand;
        private Material dirt;
        private Material water;
        private Material wood;
        private Material leaves;
        private Material stone;
        private Material metalOre;
        private Material sulfurOre;
        private Material rust;

        public int WorldSeed { get; private set; }
        public Vector3 PlayerSpawn => new Vector3(-6f, 2.2f, -10f);

        public void Generate(int seed)
        {
            ClearRuntimeWorld();
            WorldSeed = seed;
            worldRoot = new GameObject("Procedural Island - Seed " + seed).transform;
            CreateMaterials();
            ConfigureEnvironment();
            CreateTerrain();
            CreateResources(seed);
            CreateRoadLoot(seed);
        }

        public void ClearRuntimeWorld()
        {
            if (worldRoot != null)
            {
                Destroy(worldRoot.gameObject);
            }
        }

        public static Material CreateMaterial(string name, Color color, float roughness, float metallic = 0f)
        {
            Material template = Resources.Load<Material>("FarkensWorldBase");
            Material material;
            if (template != null)
            {
                material = new Material(template);
            }
            else
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                if (shader == null)
                {
                    shader = Shader.Find("Standard");
                }

                if (shader == null)
                {
                    shader = Shader.Find("Hidden/InternalErrorShader");
                }

                material = new Material(shader);
            }

            material.name = name;
            material.color = color;
            if (material.HasProperty("_Smoothness"))
            {
                material.SetFloat("_Smoothness", 1f - Mathf.Clamp01(roughness));
            }

            if (material.HasProperty("_Metallic"))
            {
                material.SetFloat("_Metallic", metallic);
            }

            return material;
        }

        private void CreateMaterials()
        {
            grass = CreateMaterial("Grass", new Color(0.23f, 0.39f, 0.16f), 0.95f);
            sand = CreateMaterial("Sand", new Color(0.72f, 0.64f, 0.43f), 0.98f);
            dirt = CreateMaterial("Road", new Color(0.27f, 0.22f, 0.16f), 1f);
            water = CreateMaterial("Water", new Color(0.05f, 0.36f, 0.52f), 0.2f, 0.08f);
            wood = CreateMaterial("Wood", new Color(0.33f, 0.18f, 0.07f), 0.95f);
            leaves = CreateMaterial("Leaves", new Color(0.1f, 0.31f, 0.08f), 0.92f);
            stone = CreateMaterial("Stone", new Color(0.4f, 0.43f, 0.45f), 0.9f);
            metalOre = CreateMaterial("Metal Ore", new Color(0.37f, 0.47f, 0.52f), 0.72f, 0.18f);
            sulfurOre = CreateMaterial("Sulfur Ore", new Color(0.73f, 0.61f, 0.09f), 0.88f);
            rust = CreateMaterial("Rusted Metal", new Color(0.49f, 0.19f, 0.08f), 0.9f, 0.25f);
        }

        private void ConfigureEnvironment()
        {
            foreach (Light existingLight in FindObjectsByType<Light>())
            {
                existingLight.gameObject.SetActive(false);
            }

            RenderSettings.fog = true;
            RenderSettings.fogColor = new Color(0.52f, 0.68f, 0.76f);
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = 110f;
            RenderSettings.fogEndDistance = 260f;
            RenderSettings.ambientLight = new Color(0.45f, 0.5f, 0.53f);

            GameObject sunObject = new GameObject("Sun");
            sunObject.transform.SetParent(worldRoot);
            sunObject.transform.rotation = Quaternion.Euler(48f, -35f, 0f);
            Light sun = sunObject.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.87f, 0.68f);
            sun.intensity = 1.4f;
            sun.shadows = LightShadows.Soft;
            RenderSettings.sun = sun;
        }

        private void CreateTerrain()
        {
            GameObject ocean = Primitive("Ocean", PrimitiveType.Cube, new Vector3(0f, -2.4f, 0f), new Vector3(300f, 2f, 300f), water, worldRoot);
            Object.Destroy(ocean.GetComponent<Collider>());

            GameObject beach = Primitive("Beach Visual", PrimitiveType.Cylinder, new Vector3(0f, -0.65f, 0f), new Vector3(164f, 0.45f, 164f), sand, worldRoot);
            RemoveCollider(beach);

            GameObject island = Primitive("Island Visual", PrimitiveType.Cylinder, new Vector3(0f, -0.45f, 0f), new Vector3(148f, 0.5f, 148f), grass, worldRoot);
            RemoveCollider(island);

            CreateWalkableCollider("Walkable Island Collider", new Vector3(0f, -0.1f, 0f), new Vector3(148f, 0.3f, 148f));
            CreateWalkableCollider("Walkable Beach Collider", new Vector3(0f, -0.28f, 0f), new Vector3(164f, 0.22f, 164f));
            CreateWalkableCollider("Fallback Safety Collider", new Vector3(0f, -1.7f, 0f), new Vector3(170f, 0.25f, 170f));

            Primitive("Road", PrimitiveType.Cube, new Vector3(0f, 0.06f, 4f), new Vector3(9f, 0.1f, 132f), dirt, worldRoot);

            Vector3[] hills =
            {
                new Vector3(-48f, -5.5f, 43f),
                new Vector3(52f, -5.8f, 35f),
                new Vector3(-55f, -6f, -39f),
                new Vector3(47f, -5.8f, -48f)
            };
            for (int i = 0; i < hills.Length; i++)
            {
                Primitive("Hill", PrimitiveType.Sphere, hills[i], new Vector3(31f, 12f, 27f), grass, worldRoot);
            }

            GameObject freshWater = Primitive("Fresh Water Pool", PrimitiveType.Cylinder, new Vector3(22f, 0.25f, -18f), new Vector3(6f, 0.18f, 6f), water, worldRoot);
            freshWater.AddComponent<WaterZone>();

            GameObject monument = new GameObject("Roadside Monument");
            monument.transform.SetParent(worldRoot);
            monument.transform.position = new Vector3(12f, 0f, 37f);
            Primitive("Floor", PrimitiveType.Cube, new Vector3(0f, 0.15f, 0f), new Vector3(12f, 0.3f, 9f), dirt, monument.transform);
            Primitive("Tower", PrimitiveType.Cube, new Vector3(0f, 4f, 0f), new Vector3(4f, 8f, 4f), rust, monument.transform);
            Primitive("Roof", PrimitiveType.Cube, new Vector3(0f, 8.2f, 0f), new Vector3(5.2f, 0.4f, 5.2f), rust, monument.transform);
        }

        private void CreateResources(int seed)
        {
            System.Random random = new System.Random(seed);
            for (int i = 0; i < 38; i++)
            {
                CreateTree(RandomPosition(random, 13f, 66f), 0.8f + (float)random.NextDouble() * 0.55f);
            }

            for (int i = 0; i < 18; i++)
            {
                CreateOreNode(ResourceNodeType.Stone, RandomPosition(random, 10f, 67f), 0.8f + (float)random.NextDouble() * 0.65f, stone);
            }

            for (int i = 0; i < 9; i++)
            {
                CreateOreNode(ResourceNodeType.MetalOre, RandomPosition(random, 22f, 66f), 0.85f + (float)random.NextDouble() * 0.5f, metalOre);
            }

            for (int i = 0; i < 7; i++)
            {
                CreateOreNode(ResourceNodeType.SulfurOre, RandomPosition(random, 26f, 66f), 0.85f + (float)random.NextDouble() * 0.5f, sulfurOre);
            }
        }

        private void CreateRoadLoot(int seed)
        {
            System.Random random = new System.Random(seed + 91);
            for (int i = 0; i < 10; i++)
            {
                float z = -52f + i * 11f;
                float x = i % 2 == 0 ? 6.2f : -6.2f;
                LootContainerType[] types =
                {
                    LootContainerType.YellowBarrel, LootContainerType.RedBarrel, LootContainerType.BlueBarrel,
                    LootContainerType.WoodenCrate, LootContainerType.Toolbox, LootContainerType.YellowBarrel,
                    LootContainerType.FoodCrate, LootContainerType.BlueBarrel, LootContainerType.MilitaryCrate, LootContainerType.RedBarrel
                };
                LootContainer.Create(new Vector3(x, 0f, z), types[i % types.Length], rust, random, worldRoot);
            }
        }

        private void CreateTree(Vector3 position, float scale)
        {
            GameObject root = new GameObject("Tree Resource");
            root.transform.SetParent(worldRoot);
            root.transform.position = position;
            root.transform.localScale = Vector3.one * scale;
            Primitive("Trunk", PrimitiveType.Cylinder, new Vector3(0f, 2.6f, 0f), new Vector3(0.85f, 2.6f, 0.85f), wood, root.transform);
            Primitive("Crown", PrimitiveType.Sphere, new Vector3(0f, 5.6f, 0f), new Vector3(4.2f, 3.8f, 4.2f), leaves, root.transform);
            Primitive("Crown Top", PrimitiveType.Sphere, new Vector3(0.4f, 7.3f, -0.3f), new Vector3(3.2f, 3f, 3.2f), leaves, root.transform);
            ResourceNode node = root.AddComponent<ResourceNode>();
            node.Configure(ResourceNodeType.Tree, 100f, 8);
        }

        private void CreateOreNode(ResourceNodeType type, Vector3 position, float scale, Material material)
        {
            GameObject root = new GameObject(type + " Resource");
            root.transform.SetParent(worldRoot);
            root.transform.position = position;
            root.transform.rotation = Quaternion.Euler(0f, UnityEngine.Random.Range(0f, 360f), 0f);
            root.transform.localScale = Vector3.one * scale;
            Primitive("Main Node", PrimitiveType.Sphere, new Vector3(0f, 0.9f, 0f), new Vector3(2.5f, 1.8f, 2.1f), material, root.transform);
            Primitive("Node Chunk", PrimitiveType.Sphere, new Vector3(0.8f, 0.45f, 0.45f), new Vector3(1.3f, 0.9f, 1.2f), material, root.transform);
            ResourceNode node = root.AddComponent<ResourceNode>();
            node.Configure(type, 110f, type == ResourceNodeType.Stone ? 8 : 6);
        }

        private static Vector3 RandomPosition(System.Random random, float minRadius, float maxRadius)
        {
            float angle = (float)random.NextDouble() * Mathf.PI * 2f;
            float radius = Mathf.Lerp(minRadius, maxRadius, Mathf.Sqrt((float)random.NextDouble()));
            return new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius);
        }

        private void CreateWalkableCollider(string name, Vector3 localPosition, Vector3 localScale)
        {
            GameObject colliderObject = new GameObject(name);
            colliderObject.transform.SetParent(worldRoot, false);
            colliderObject.transform.localPosition = localPosition;
            colliderObject.transform.localScale = localScale;
            BoxCollider box = colliderObject.AddComponent<BoxCollider>();
            box.center = Vector3.zero;
            box.size = Vector3.one;
        }

        private static void RemoveCollider(GameObject target)
        {
            Collider collider = target.GetComponent<Collider>();
            if (collider != null)
            {
                Object.Destroy(collider);
            }
        }

        public static GameObject Primitive(string name, PrimitiveType type, Vector3 localPosition, Vector3 localScale, Material material, Transform parent)
        {
            GameObject primitive = GameObject.CreatePrimitive(type);
            primitive.name = name;
            primitive.transform.SetParent(parent, false);
            primitive.transform.localPosition = localPosition;
            primitive.transform.localScale = localScale;
            primitive.GetComponent<Renderer>().sharedMaterial = material;
            return primitive;
        }
    }
}