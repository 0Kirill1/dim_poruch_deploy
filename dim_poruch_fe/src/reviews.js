import { apiRequest } from './api';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_RELATION_PATTERN = /tenant|reviewer|reviewedBy|author|renter|reviewee|user|profile|createdBy|creator/i;

function nestedUserId(value) {
  if (typeof value === 'string') return UUID_PATTERN.test(value) ? value : '';
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) return value.map(nestedUserId).find(Boolean) || '';

  for (const [key, candidate] of Object.entries(value)) {
    if ((key === 'id' || /(?:id|uuid)$/i.test(key)) && typeof candidate === 'string' && UUID_PATTERN.test(candidate)) return candidate;
  }
  for (const [key, candidate] of Object.entries(value)) {
    if (USER_RELATION_PATTERN.test(key)) {
      const found = nestedUserId(candidate);
      if (found) return found;
    }
  }
  return '';
}

function reviewerId(review) {
  const directIds = [
    review.tenantId,
    review.tenantUserId,
    review.tenantProfileId,
    review.tenantUuid,
    review.tenantUUID,
    review.tenant_id,
    review.tenant_user_id,
    review.tenantUserUuid,
    review.reviewerId,
    review.reviewerUserId,
    review.reviewerUuid,
    review.reviewer_id,
    review.reviewer_user_id,
    review.authorId,
    review.authorUserId,
    review.authorUuid,
    review.author_id,
    review.userId,
    review.userUuid,
    review.user_id,
    review.renterId,
    review.booking?.tenantId,
    review.booking?.tenantUserId,
    review.booking?.tenant?.id,
  ];
  const nestedRefs = Object.entries(review).filter(([key]) => USER_RELATION_PATTERN.test(key)).map(([, value]) => value);
  const candidate = [...directIds, ...nestedRefs.map(nestedUserId)].find((value) => typeof value === 'string' && UUID_PATTERN.test(value));
  return candidate || '';
}

export async function attachPublicReviewerProfiles(reviews) {
  const ids = [...new Set(reviews.map(reviewerId).filter(Boolean))];
  const profiles = await Promise.allSettled(ids.map((id) => apiRequest(`/users/${encodeURIComponent(id)}/public-profile`, { auth: false })));
  const profilesById = new Map();
  profiles.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const profile = result.value;
      profilesById.set(ids[index], { ...profile, fullName: profile?.fullName || profile?.full_name || profile?.name || profile?.displayName });
    }
  });
  return reviews.map((review) => ({ ...review, publicAuthor: profilesById.get(reviewerId(review)) || null }));
}

export function reviewAuthorName(review) {
  return review.publicAuthor?.fullName
    || review.tenantName
    || review.tenant_name
    || review.authorName
    || review.author_name
    || review.tenantProfile?.fullName
    || review.userProfile?.fullName
    || review.renterName
    || review.tenant?.fullName
    || review.tenant?.name
    || review.reviewer?.fullName
    || review.reviewer?.name
    || review.author?.fullName
    || review.author?.name
    || review.user?.fullName
    || review.user?.name
    || 'Орендар';
}
