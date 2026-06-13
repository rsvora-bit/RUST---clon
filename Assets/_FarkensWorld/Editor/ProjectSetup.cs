using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace FarkensWorld.Editor
{
    public static class ProjectSetup
    {
        private const string MainScenePath = "Assets/_FarkensWorld/Scenes/Main.unity";

        [MenuItem("Farken's World/Rebuild Main Scene")]
        public static void CreateMainScene()
        {
            EnsureFolder("Assets/_FarkensWorld");
            EnsureFolder("Assets/_FarkensWorld/Scenes");
            EnsureFolder("Assets/_FarkensWorld/Prefabs");
            EnsureFolder("Assets/_FarkensWorld/Materials");
            EnsureFolder("Assets/_FarkensWorld/ScriptableObjects");
            EnsureFolder("Assets/_FarkensWorld/UI");
            EnsureFolder("Assets/_FarkensWorld/Resources");
            CreateBaseMaterial();

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            GameObject root = new GameObject("Farken's World - Main Scene");
            root.AddComponent<Bootstrap>();
            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, MainScenePath);

            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(MainScenePath, true) };
            PlayerSettings.productName = "Farken's World";
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log("Farken's World main scene created at " + MainScenePath);
        }

        private static void CreateBaseMaterial()
        {
            const string materialPath = "Assets/_FarkensWorld/Resources/FarkensWorldBase.mat";
            Material existing = AssetDatabase.LoadAssetAtPath<Material>(materialPath);
            if (existing != null)
            {
                return;
            }

            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
            {
                throw new System.InvalidOperationException("URP Lit shader was not found while creating the base material.");
            }

            Material material = new Material(shader)
            {
                name = "FarkensWorldBase",
                color = Color.white
            };
            AssetDatabase.CreateAsset(material, materialPath);
        }

        private static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path))
            {
                return;
            }

            int slash = path.LastIndexOf('/');
            string parent = path.Substring(0, slash);
            string folder = path.Substring(slash + 1);
            EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, folder);
        }
    }
}
