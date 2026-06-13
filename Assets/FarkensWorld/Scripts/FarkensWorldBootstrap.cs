using System;
using UnityEngine;
using Object = UnityEngine.Object;

namespace FarkensWorld
{
    public sealed class FarkensWorldBootstrap : MonoBehaviour
    {
        private Transform worldRoot;
        private Material grassMaterial;
        private Material dirtMaterial;
        private Material waterMaterial;
        private Material roadMaterial;
        private Material woodMaterial;
        private Material leavesMaterial;
        private Material stoneMaterial;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void StartPrototype()
        {
            if (Object.FindAnyObjectByType<FarkensWorldBootstrap>() != null)
            {
                return;
            }

            GameObject bootstrap = new GameObject("Farken's World Bootstrap");
            bootstrap.AddComponent<FarkensWorldBootstrap>();
        }

        private void Awake()
        {
            DisableTemplateObjects();
            CreateMaterials();
            CreateEnvironment();
            CreatePlayer();
        }

        private void DisableTemplateObjects()
        {
            foreach (Camera sceneCamera in Object.FindObjectsByType<Camera>())
            {
                sceneCamera.gameObject.SetActive(false);
            }

            foreach (Light sceneLight in Object.FindObjectsByType<Light>())
            {
                sceneLight.gameObject.SetActive(false);
            }
        }

        private void CreateMaterials()
        {
            grassMaterial = CreateMaterial("Grass", new Color(0.24f, 0.39f, 0.17f), 0.92f);
            dirtMaterial = CreateMaterial("Dirt", new Color(0.32f, 0.23f, 0.13f), 1f);
            waterMaterial = CreateMaterial("Water", new Color(0.06f, 0.35f, 0.52f), 0.28f, 0.15f);
            roadMaterial = CreateMaterial("Road", new Color(0.24f, 0.22f, 0.19f), 1f);
            woodMaterial = CreateMaterial("Wood", new Color(0.29f, 0.16f, 0.07f), 0.95f);
            leavesMaterial = CreateMaterial("Leaves", new Color(0.12f, 0.31f, 0.1f), 0.9f);
            stoneMaterial = CreateMaterial("Stone", new Color(0.36f, 0.39f, 0.4f), 0.86f);
        }

        private void CreateEnvironment()
        {
            worldRoot = new GameObject("Procedural Test Island").transform;

            RenderSettings.fog = true;
            RenderSettings.fogColor = new Color(0.52f, 0.68f, 0.76f);
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = 90f;
            RenderSettings.fogEndDistance = 230f;
            RenderSettings.ambientLight = new Color(0.47f, 0.52f, 0.55f);

            CreatePrimitive("Ocean", PrimitiveType.Cube, new Vector3(0f, -2.1f, 0f), new Vector3(280f, 2f, 280f), waterMaterial, worldRoot);
            CreatePrimitive("Island Ground", PrimitiveType.Cube, new Vector3(0f, -0.5f, 0f), new Vector3(145f, 1f, 145f), grassMaterial, worldRoot);
            CreatePrimitive("Dirt Road", PrimitiveType.Cube, new Vector3(0f, 0.03f, 5f), new Vector3(10f, 0.08f, 130f), roadMaterial, worldRoot);

            CreateHills();
            CreateResources();
            CreateSun();
        }

        private void CreateHills()
        {
            Vector3[] positions =
            {
                new Vector3(-52f, -2f, 47f),
                new Vector3(53f, -2.3f, 36f),
                new Vector3(-58f, -2.6f, -42f),
                new Vector3(48f, -2.5f, -49f)
            };

            foreach (Vector3 position in positions)
            {
                CreatePrimitive("Low Hill", PrimitiveType.Sphere, position, new Vector3(34f, 9f, 28f), dirtMaterial, worldRoot);
            }
        }

        private void CreateResources()
        {
            System.Random random = new System.Random(151);

            for (int i = 0; i < 34; i++)
            {
                Vector3 position = RandomIslandPosition(random, 12f, 64f);
                CreateTree(position, 0.85f + (float)random.NextDouble() * 0.55f);
            }

            for (int i = 0; i < 24; i++)
            {
                Vector3 position = RandomIslandPosition(random, 10f, 66f);
                CreateRock(position, 0.7f + (float)random.NextDouble() * 0.7f, random.Next(0, 360));
            }
        }

        private void CreateTree(Vector3 position, float scale)
        {
            GameObject tree = new GameObject("Harvestable Tree");
            tree.transform.SetParent(worldRoot);
            tree.transform.position = position;
            tree.transform.localScale = Vector3.one * scale;

            CreatePrimitive("Trunk", PrimitiveType.Cylinder, new Vector3(0f, 2.5f, 0f), new Vector3(0.9f, 2.5f, 0.9f), woodMaterial, tree.transform, true);
            CreatePrimitive("Crown Lower", PrimitiveType.Sphere, new Vector3(0f, 5.3f, 0f), new Vector3(4.2f, 3.5f, 4.2f), leavesMaterial, tree.transform, true);
            CreatePrimitive("Crown Upper", PrimitiveType.Sphere, new Vector3(0.5f, 7.2f, -0.2f), new Vector3(3.2f, 3.3f, 3.2f), leavesMaterial, tree.transform, true);

            FarkenResourceNode node = tree.AddComponent<FarkenResourceNode>();
            node.Configure(ResourceKind.Tree, 4, 15);
        }

        private void CreateRock(Vector3 position, float scale, float rotation)
        {
            GameObject rock = new GameObject("Harvestable Rock");
            rock.transform.SetParent(worldRoot);
            rock.transform.position = position;
            rock.transform.rotation = Quaternion.Euler(0f, rotation, 0f);
            rock.transform.localScale = Vector3.one * scale;

            CreatePrimitive("Stone", PrimitiveType.Sphere, new Vector3(0f, 0.85f, 0f), new Vector3(2.4f, 1.7f, 2f), stoneMaterial, rock.transform, true);
            CreatePrimitive("Stone Chip", PrimitiveType.Sphere, new Vector3(0.7f, 0.42f, 0.55f), new Vector3(1.3f, 0.8f, 1.1f), stoneMaterial, rock.transform, true);

            FarkenResourceNode node = rock.AddComponent<FarkenResourceNode>();
            node.Configure(ResourceKind.Rock, 5, 10);
        }

        private void CreateSun()
        {
            GameObject sunObject = new GameObject("Sun");
            sunObject.transform.SetParent(worldRoot);
            sunObject.transform.rotation = Quaternion.Euler(45f, -35f, 0f);

            Light sun = sunObject.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.87f, 0.68f);
            sun.intensity = 1.35f;
            sun.shadows = LightShadows.Soft;
            RenderSettings.sun = sun;
        }

        private static Vector3 RandomIslandPosition(System.Random random, float minRadius, float maxRadius)
        {
            float angle = (float)random.NextDouble() * Mathf.PI * 2f;
            float radius = Mathf.Lerp(minRadius, maxRadius, Mathf.Sqrt((float)random.NextDouble()));
            return new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius);
        }

        private void CreatePlayer()
        {
            GameObject player = new GameObject("Player");
            player.transform.position = new Vector3(-5f, 1.1f, -8f);

            CharacterController controller = player.AddComponent<CharacterController>();
            controller.height = 1.8f;
            controller.radius = 0.35f;
            controller.center = new Vector3(0f, 0.9f, 0f);
            controller.stepOffset = 0.35f;
            controller.slopeLimit = 50f;

            player.AddComponent<FarkenPlayerController>();
            player.AddComponent<FarkenSurvivalHud>();
        }

        private static GameObject CreatePrimitive(
            string objectName,
            PrimitiveType primitiveType,
            Vector3 localPosition,
            Vector3 localScale,
            Material material,
            Transform parent,
            bool keepCollider = true)
        {
            GameObject primitive = GameObject.CreatePrimitive(primitiveType);
            primitive.name = objectName;
            primitive.transform.SetParent(parent, false);
            primitive.transform.localPosition = localPosition;
            primitive.transform.localScale = localScale;

            Renderer renderer = primitive.GetComponent<Renderer>();
            renderer.sharedMaterial = material;

            if (!keepCollider)
            {
                Collider collider = primitive.GetComponent<Collider>();
                if (collider != null)
                {
                    Destroy(collider);
                }
            }

            return primitive;
        }

        private static Material CreateMaterial(string materialName, Color color, float smoothness, float metallic = 0f)
        {
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
            {
                shader = Shader.Find("Standard");
            }

            Material material = new Material(shader)
            {
                name = materialName,
                color = color
            };

            if (material.HasProperty("_Smoothness"))
            {
                material.SetFloat("_Smoothness", 1f - smoothness);
            }

            if (material.HasProperty("_Metallic"))
            {
                material.SetFloat("_Metallic", metallic);
            }

            return material;
        }
    }
}
