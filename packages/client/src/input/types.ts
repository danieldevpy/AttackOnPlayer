// ADR-015: todo perfil de controle produz a MESMA intenção — o servidor (SPEC-0003/0005)
// já aceita `aimX/aimZ` opcional (sobrepõe o facing por movimento) e não muda.
export interface Intent {
  moveX: number;
  moveZ: number;
  aimX?: number;
  aimZ?: number;
  fire: boolean;
}

export interface ControlProfile {
  readonly id: string;
  attach(): void;
  detach(): void;
  poll(): Intent;
}
