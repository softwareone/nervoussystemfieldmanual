const KLAVIYO_REVISION = '2024-02-15';

async function createKlaviyoContact({ email, name }) {
  const apiKey = process.env.KLAVIYO_API_KEY;
  const listId = process.env.KLAVIYO_LIST_ID;

  if (!apiKey) {
    console.warn('Klaviyo not configured — skipping contact creation.');
    return;
  }

  const [firstName, ...rest] = (name || '').split(' ');
  const lastName = rest.join(' ');

  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    revision: KLAVIYO_REVISION
  };

  const profileRes = await fetch('https://a.klaviyo.com/api/profiles/', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: {
        type: 'profile',
        attributes: {
          email,
          first_name: firstName || '',
          last_name: lastName || '',
          properties: {
            nsfm_purchaser: true,
            product: 'NSFM Ebook',
            purchase_date: new Date().toISOString()
          }
        }
      }
    })
  });

  const profileData = await profileRes.json();
  // 409 means the profile already exists — Klaviyo returns the existing id in the error payload.
  const profileId = profileData?.data?.id || profileData?.errors?.[0]?.meta?.duplicate_profile_id;

  if (!profileId) {
    console.error('Klaviyo profile creation failed:', JSON.stringify(profileData));
    return;
  }

  if (!listId) {
    console.warn('KLAVIYO_LIST_ID not set — profile created but not added to a list.');
    return;
  }

  await fetch(`https://a.klaviyo.com/api/lists/${listId}/relationships/profiles/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: [{ type: 'profile', id: profileId }] })
  });

  console.log(`✓ Klaviyo: ${email} added to NSFM Buyers list`);
}

module.exports = { createKlaviyoContact };
