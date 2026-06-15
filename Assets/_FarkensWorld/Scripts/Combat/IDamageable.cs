using UnityEngine;

namespace FarkensWorld
{
    public interface IDamageable
    {
        bool IsAlive { get; }
        void Damage(float amount, Vector3 hitPoint, GameObject source);
    }
}
