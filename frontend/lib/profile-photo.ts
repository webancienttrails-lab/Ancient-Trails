const profilePhotoStoragePrefix = "ancient_trails_profile_photo_";
const profilePhotoChangeEvent = "ancient-trails-profile-photo-change";

export function getProfilePhotoStorageKey(userId: string) {
  return `${profilePhotoStoragePrefix}${userId}`;
}

export function getStoredProfilePhoto(userId?: string) {
  if (typeof window === "undefined" || !userId) {
    return "";
  }

  return window.localStorage.getItem(getProfilePhotoStorageKey(userId)) || "";
}

export function saveStoredProfilePhoto(userId: string, photoData: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getProfilePhotoStorageKey(userId), photoData);
  window.dispatchEvent(new Event(profilePhotoChangeEvent));
}

export function removeStoredProfilePhoto(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getProfilePhotoStorageKey(userId));
  window.dispatchEvent(new Event(profilePhotoChangeEvent));
}

export function listenForProfilePhotoChanges(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(profilePhotoStoragePrefix)) {
      listener();
    }
  };

  window.addEventListener(profilePhotoChangeEvent, listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(profilePhotoChangeEvent, listener);
    window.removeEventListener("storage", handleStorage);
  };
}
