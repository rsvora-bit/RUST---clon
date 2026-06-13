using UnityEngine;

namespace FarkensWorld
{
    public enum BuildGrade
    {
        Wood,
        Stone,
        Metal
    }

    public sealed class BuildPiece : MonoBehaviour
    {
        [SerializeField] private BuildPieceType type;
        [SerializeField] private BuildGrade grade;
        [SerializeField] private float health;
        [SerializeField] private float maxHealth;

        public BuildPieceType Type => type;
        public BuildGrade Grade => grade;
        public float Health => health;
        public float MaxHealth => maxHealth;

        public void Initialize(BuildPieceType pieceType, BuildGrade pieceGrade = BuildGrade.Wood)
        {
            type = pieceType;
            grade = pieceGrade;
            maxHealth = GradeHealth(pieceGrade);
            health = maxHealth;
            gameObject.name = "Build - " + pieceType;
        }

        public bool Upgrade()
        {
            Inventory inventory = GameManager.Instance.PlayerInventory;
            if (grade == BuildGrade.Wood && inventory.Remove("stone", 120))
            {
                grade = BuildGrade.Stone;
            }
            else if (grade == BuildGrade.Stone && inventory.Remove("metalFragments", 180))
            {
                grade = BuildGrade.Metal;
            }
            else
            {
                return false;
            }

            maxHealth = GradeHealth(grade);
            health = maxHealth;
            ApplyGradeColor();
            return true;
        }

        public bool Repair()
        {
            if (health >= maxHealth)
            {
                return false;
            }

            string resource = grade == BuildGrade.Wood ? "wood" : grade == BuildGrade.Stone ? "stone" : "metalFragments";
            int cost = grade == BuildGrade.Wood ? 18 : grade == BuildGrade.Stone ? 26 : 35;
            if (!GameManager.Instance.PlayerInventory.Remove(resource, cost))
            {
                return false;
            }

            health = maxHealth;
            return true;
        }

        public void Restore(BuildGrade savedGrade, float savedHealth)
        {
            grade = savedGrade;
            maxHealth = GradeHealth(grade);
            health = Mathf.Clamp(savedHealth, 1f, maxHealth);
            ApplyGradeColor();
        }

        private void ApplyGradeColor()
        {
            Color color = grade == BuildGrade.Wood
                ? new Color(0.42f, 0.23f, 0.08f)
                : grade == BuildGrade.Stone
                    ? new Color(0.47f, 0.5f, 0.51f)
                    : new Color(0.38f, 0.47f, 0.52f);
            Renderer[] renderers = GetComponentsInChildren<Renderer>();
            for (int i = 0; i < renderers.Length; i++)
            {
                renderers[i].sharedMaterial = WorldGenerator.CreateMaterial("Build " + grade, color, 0.85f, grade == BuildGrade.Metal ? 0.45f : 0f);
            }
        }

        private static float GradeHealth(BuildGrade buildGrade)
        {
            return buildGrade == BuildGrade.Wood ? 80f : buildGrade == BuildGrade.Stone ? 150f : 240f;
        }
    }
}
