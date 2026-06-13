using UnityEngine;

namespace FarkensWorld
{
    public sealed class Bootstrap : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureRuntimeExists()
        {
            if (FindAnyObjectByType<GameManager>() != null)
            {
                return;
            }

            GameObject runtime = new GameObject("Farken's World Runtime");
            runtime.AddComponent<GameManager>();
        }
    }
}
