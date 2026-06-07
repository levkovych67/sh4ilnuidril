interface WayforpayInstance {
  run(params: Record<string, unknown>): void;
}
interface Window {
  Wayforpay?: new () => WayforpayInstance;
}
