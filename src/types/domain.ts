export const TicketStatus = {
    Available: "AVAILABLE",
    Reserved: "RESERVED",
    Sold: "SOLD",
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const UserRole = {
    Admin: "ADMIN",
    User: "USER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export type UnixSeconds = number & { readonly __brand: "UnixSeconds" };

export interface CardDetails {
    cardNumber: string;
    expiryDate: string;
    cvv: string;
    cardHolderName: string;
}