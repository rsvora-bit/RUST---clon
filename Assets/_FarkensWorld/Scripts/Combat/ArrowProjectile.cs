using UnityEngine;

namespace FarkensWorld
{
    [RequireComponent(typeof(Rigidbody), typeof(Collider))]
    public sealed class ArrowProjectile : MonoBehaviour
    {
        private PlayerCombat owner;
        private Rigidbody body;
        private float damage;
        private float expiresAt;
        private bool active;

        private void Awake()
        {
            body = GetComponent<Rigidbody>();
        }

        private void Update()
        {
            if (!active)
            {
                return;
            }

            if (body.linearVelocity.sqrMagnitude > 0.25f)
            {
                transform.rotation = Quaternion.LookRotation(body.linearVelocity.normalized) * Quaternion.Euler(90f, 0f, 0f);
            }

            if (Time.time >= expiresAt || transform.position.y < -25f)
            {
                owner.RecycleArrow(this);
            }
        }

        public void Launch(PlayerCombat projectileOwner, Vector3 position, Vector3 direction, float projectileDamage)
        {
            owner = projectileOwner;
            damage = projectileDamage;
            active = true;
            expiresAt = Time.time + 5f;
            transform.SetPositionAndRotation(position, Quaternion.LookRotation(direction) * Quaternion.Euler(90f, 0f, 0f));
            body.linearVelocity = direction.normalized * 34f;
            body.angularVelocity = Vector3.zero;
            body.useGravity = true;
            gameObject.SetActive(true);
        }

        public void PrepareForPool()
        {
            active = false;
            if (body != null)
            {
                body.linearVelocity = Vector3.zero;
                body.angularVelocity = Vector3.zero;
            }
            gameObject.SetActive(false);
        }

        private void OnCollisionEnter(Collision collision)
        {
            if (!active)
            {
                return;
            }

            MonoBehaviour[] behaviours = collision.collider.GetComponentsInParent<MonoBehaviour>();
            for (int i = 0; i < behaviours.Length; i++)
            {
                if (behaviours[i] is IDamageable target && target.IsAlive)
                {
                    Vector3 point = collision.contactCount > 0 ? collision.GetContact(0).point : transform.position;
                    target.Damage(damage, point, owner.gameObject);
                    GameManager.Instance.Audio.Play(AudioCue.ArrowHit, Random.Range(0.92f, 1.08f));
                    GameEvents.RaiseFeed("Arrow hit for " + Mathf.RoundToInt(damage));
                    break;
                }
            }

            owner.RecycleArrow(this);
        }
    }
}
