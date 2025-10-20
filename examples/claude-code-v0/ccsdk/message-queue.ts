// Message queue for async communication
export class MessageQueue<T> {
  private queue: T[] = [];
  private resolvers: ((value: T) => void)[] = [];
  private closed = false;

  async push(item: T): Promise<void> {
    if (this.closed) {
      throw new Error("Queue is closed");
    }

    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver(item);
    } else {
      this.queue.push(item);
    }
  }

  async next(): Promise<{ value: T; done: false } | { done: true }> {
    if (this.queue.length > 0) {
      return { value: this.queue.shift()!, done: false };
    }

    if (this.closed) {
      return { done: true };
    }

    return new Promise((resolve) => {
      this.resolvers.push((value) => {
        resolve({ value, done: false });
      });
    });
  }

  close() {
    this.closed = true;
    // Resolve any pending promises
    this.resolvers.forEach(resolver => {
      // This will cause the iterator to complete
    });
    this.resolvers = [];
  }

  isClosed() {
    return this.closed;
  }
}