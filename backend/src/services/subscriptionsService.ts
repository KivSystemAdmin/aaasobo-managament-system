import { prisma } from "../../prisma/prismaClient";

export async function getActiveSubscription(customerId: number) {
  try {
    // A subscription is active if its endAt is null.
    // Assume a customer only has one active subscription.
    const subscriptions = await prisma.subscription.findMany({
      where: { customerId, endAt: null },
      include: { plan: true },
    });
    if (subscriptions.length > 1) {
      throw new Error("Multiple active subscriptions found.");
    }
    return subscriptions[0];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch subscription.");
  }
}

export const getAllSubscriptions = async () => {
  // Fetch all subscriptions data from the DB
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: { plan: true, customer: { include: { children: true } } },
      orderBy: { customer: { id: "asc" } },
    });

    return subscriptions;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch subscriptions.");
  }
};

export const getSubscriptionsById = async (customerId: number) => {
  // Fetch subscriptions by customer id
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { customerId },
      include: { plan: true },
    });

    return subscriptions;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the customer's subscriptions.");
  }
};

// Create new subscriptions
export const createNewSubscription = async (subscriptionData: {
  planId: number;
  customerId: number;
  startAt: Date;
}) => {
  try {
    const newSubscription = await prisma.subscription.create({
      data: subscriptionData,
    });
    return newSubscription;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to create new subscription.");
  }
};

// Get subscription by subscription id
export const getSubscriptionById = async (subscriptionId: number) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, customer: true },
    });

    return subscription;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch subscription.");
  }
};
