type ScrollLock = {
  owners: Set<symbol>;
  overflow: string;
  priority: string;
};

const locks = new WeakMap<HTMLElement, ScrollLock>();

// Each overlay releases only its own lock, regardless of close/unmount order.
export function lockDocumentScroll(includeRoot = false) {
  const owner = Symbol("scroll-lock");
  const elements = includeRoot
    ? [document.body, document.documentElement]
    : [document.body];

  for (const element of elements) {
    let lock = locks.get(element);
    if (!lock) {
      lock = {
        owners: new Set(),
        overflow: element.style.getPropertyValue("overflow"),
        priority: element.style.getPropertyPriority("overflow"),
      };
      locks.set(element, lock);
      element.style.setProperty("overflow", "hidden");
    }
    lock.owners.add(owner);
  }

  return () => {
    for (const element of elements) {
      const lock = locks.get(element);
      if (!lock || !lock.owners.delete(owner) || lock.owners.size) continue;
      if (lock.overflow) element.style.setProperty("overflow", lock.overflow, lock.priority);
      else element.style.removeProperty("overflow");
      locks.delete(element);
    }
  };
}
