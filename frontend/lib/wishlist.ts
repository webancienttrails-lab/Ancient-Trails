import { getTravellerSession } from "@/lib/auth";

export type WishlistTourSnapshot = {
  categoryLabel: string;
  description: string;
  destinationLabel: string;
  difficultyLabel: string;
  durationLabel: string;
  href: string;
  image: string;
  nextDepartureLabel: string;
  priceLabel: string;
  title: string;
  tourId: string;
};

export type WishlistTourItem = {
  savedAt: string;
  snapshot?: WishlistTourSnapshot;
  tourId: string;
};

const wishlistStoragePrefix = "ancient_trails_wishlist";
const guestWishlistStorageKey = `${wishlistStoragePrefix}:guest`;
const wishlistEventName = "ancient-trails-wishlist-change";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function normalizeWishlistTourId(tourId: string) {
  return tourId.trim().toUpperCase();
}

function getWishlistStorageKey() {
  if (!canUseStorage()) {
    return guestWishlistStorageKey;
  }

  const travellerId = getTravellerSession()?.user.id?.trim();

  return travellerId
    ? `${wishlistStoragePrefix}:${travellerId}`
    : guestWishlistStorageKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSavedAt(value: unknown) {
  const savedAt = getString(value);

  if (!savedAt) {
    return new Date(0).toISOString();
  }

  const timestamp = new Date(savedAt).getTime();

  return Number.isNaN(timestamp) ? new Date(0).toISOString() : savedAt;
}

function normalizeSnapshot(value: unknown): WishlistTourSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const tourId = normalizeWishlistTourId(getString(value.tourId));
  const title = getString(value.title);

  if (!tourId || !title) {
    return undefined;
  }

  return {
    categoryLabel: getString(value.categoryLabel),
    description: getString(value.description),
    destinationLabel: getString(value.destinationLabel),
    difficultyLabel: getString(value.difficultyLabel),
    durationLabel: getString(value.durationLabel),
    href: getString(value.href),
    image: getString(value.image),
    nextDepartureLabel: getString(value.nextDepartureLabel),
    priceLabel: getString(value.priceLabel),
    title,
    tourId,
  };
}

function normalizeStoredItem(value: unknown): WishlistTourItem | null {
  if (typeof value === "string") {
    const tourId = normalizeWishlistTourId(value);

    return tourId ? { savedAt: new Date(0).toISOString(), tourId } : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const tourId = normalizeWishlistTourId(getString(value.tourId));

  if (!tourId) {
    return null;
  }

  return {
    savedAt: normalizeSavedAt(value.savedAt),
    snapshot: normalizeSnapshot(value.snapshot),
    tourId,
  };
}

function sortWishlistItems(items: WishlistTourItem[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime()
  );
}

function mergeWishlistItems(...groups: WishlistTourItem[][]) {
  const itemsById = new Map<string, WishlistTourItem>();

  sortWishlistItems(groups.flat()).forEach((item) => {
    if (!itemsById.has(item.tourId)) {
      itemsById.set(item.tourId, item);
    }
  });

  return sortWishlistItems(Array.from(itemsById.values()));
}

function readStoredItemsFromKey(storageKey: string): WishlistTourItem[] {
  if (!canUseStorage()) {
    return [];
  }

  const storedValue = window.localStorage.getItem(storageKey);

  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;
    const rawItems =
      isRecord(parsedValue) && Array.isArray(parsedValue.items)
        ? parsedValue.items
        : Array.isArray(parsedValue)
          ? parsedValue
          : [];

    return mergeWishlistItems(
      rawItems
        .map((item) => normalizeStoredItem(item))
        .filter((item): item is WishlistTourItem => Boolean(item))
    );
  } catch {
    return [];
  }
}

function writeStoredItemsToKey(storageKey: string, items: WishlistTourItem[]) {
  if (!canUseStorage()) {
    return;
  }

  if (items.length === 0) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(
    storageKey,
    JSON.stringify({ items: sortWishlistItems(items), version: 1 })
  );
}

function emitWishlistChange() {
  if (!canUseStorage()) {
    return;
  }

  window.dispatchEvent(new Event(wishlistEventName));
}

export function readWishlistItems() {
  if (!canUseStorage()) {
    return [];
  }

  const storageKey = getWishlistStorageKey();
  const savedItems = readStoredItemsFromKey(storageKey);

  if (storageKey === guestWishlistStorageKey) {
    return savedItems;
  }

  const guestItems = readStoredItemsFromKey(guestWishlistStorageKey);

  if (guestItems.length === 0) {
    return savedItems;
  }

  const mergedItems = mergeWishlistItems(savedItems, guestItems);

  writeStoredItemsToKey(storageKey, mergedItems);
  window.localStorage.removeItem(guestWishlistStorageKey);

  return mergedItems;
}

export function getWishlistTourIds() {
  return readWishlistItems().map((item) => item.tourId);
}

export function isTourWishlisted(tourId: string) {
  const normalizedTourId = normalizeWishlistTourId(tourId);

  if (!normalizedTourId) {
    return false;
  }

  return readWishlistItems().some((item) => item.tourId === normalizedTourId);
}

export function toggleWishlistTour(snapshot: WishlistTourSnapshot) {
  const tourId = normalizeWishlistTourId(snapshot.tourId);
  const currentItems = readWishlistItems();

  if (!tourId) {
    return { isWishlisted: false, items: currentItems };
  }

  const existingItem = currentItems.find((item) => item.tourId === tourId);
  const nextItems = existingItem
    ? currentItems.filter((item) => item.tourId !== tourId)
    : [
        {
          savedAt: new Date().toISOString(),
          snapshot: { ...snapshot, tourId },
          tourId,
        },
        ...currentItems,
      ];

  writeStoredItemsToKey(getWishlistStorageKey(), nextItems);
  emitWishlistChange();

  return { isWishlisted: !existingItem, items: sortWishlistItems(nextItems) };
}

export function removeWishlistTour(tourId: string) {
  const normalizedTourId = normalizeWishlistTourId(tourId);
  const nextItems = readWishlistItems().filter(
    (item) => item.tourId !== normalizedTourId
  );

  writeStoredItemsToKey(getWishlistStorageKey(), nextItems);
  emitWishlistChange();

  return nextItems;
}

export function listenForWishlistChanges(listener: () => void) {
  if (!canUseStorage()) {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith(wishlistStoragePrefix)) {
      listener();
    }
  };

  window.addEventListener(wishlistEventName, listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(wishlistEventName, listener);
    window.removeEventListener("storage", handleStorage);
  };
}
