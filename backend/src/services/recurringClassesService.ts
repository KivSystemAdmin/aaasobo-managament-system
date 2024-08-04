import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/prismaClient";

// Create a new recurring class in the DB
export const addRecurringClass = async (
  tx: Prisma.TransactionClient,
  instructorId: number,
  customerId: number,
  childrenIds: number[],
  subscriptionId: number,
  startAt: Date,
  dateTimes: Date[],
  endAt: Date | null,
) => {
  try {
    // Add the regular class to the RecurringClass table.
    const recurring = await tx.recurringClass.create({
      data: {
        instructorId,
        subscriptionId,
        startAt,
        endAt,
      },
    });
    // Add the classes to the Class table based on the Recurring Class ID.
    const createdClasses = await tx.class.createManyAndReturn({
      data: dateTimes.map((dateTime) => ({
        instructorId,
        customerId,
        recurringClassId: recurring.id,
        subscriptionId,
        dateTime,
        status: "booked",
      })),
    });
    // Add the Class Attendance to the ClassAttendance Table based on the Class ID.
    await tx.classAttendance.createMany({
      data: createdClasses
        .map((createdClass) => {
          return childrenIds.map((childrenId) => ({
            classId: createdClass.id,
            childrenId,
          }));
        })
        .flat(),
    });
    // Add the children with recurring class to the RecurringClassAttendance table.
    await tx.recurringClassAttendance.createMany({
      data: childrenIds.map((childrenId) => ({
        recurringClassId: recurring.id,
        childrenId,
      })),
    });
    return recurring;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to add recurring class.");
  }
};

// Fetch recurring classes by subscription id along with related instructors and customers data
export const getRecurringClassesBySubscriptionId = async (
  subscriptionId: number,
) => {
  try {
    const recurringClasses = await prisma.recurringClass.findMany({
      where: { subscriptionId },
      include: {
        subscription: {
          include: {
            customer: true,
            plan: true,
          },
        },
        instructor: true,
        recurringClassAttendance: { include: { children: true } },
      },
    });

    return recurringClasses;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch recurring classes.");
  }
};

// Update the end date to the recurring class.
export const terminateRecurringClass = async (
  tx: Prisma.TransactionClient,
  recurringClassId: number,
  endAt: Date,
) => {
  try {
    // Update the endAt to the RecurringClass table.
    const recurringClass = await tx.recurringClass.update({
      where: { id: recurringClassId },
      data: {
        endAt,
      },
    });

    // Fetch the classes to be deleted based on recurring class id and startAt.
    const classesToDelete = await tx.class.findMany({
      where: {
        recurringClassId,
        dateTime: {
          gt: endAt,
        },
      },
      select: { id: true },
    });

    const classIdsToDelete = classesToDelete.map((classObj) => classObj.id);

    // Delete class attendance associated with the class IDs.
    await tx.classAttendance.deleteMany({
      where: { classId: { in: classIdsToDelete } },
    });

    // Delete the classes themselves.
    await tx.class.deleteMany({
      where: { id: { in: classIdsToDelete } },
    });

    return recurringClass;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to update the end date to recurring class.");
  }
};

// Fetch recurring classes by recurring class id
export const getRecurringClassByRecurringClassId = async (
  tx: Prisma.TransactionClient,
  recurringClassId: number,
) => {
  try {
    const recurringClass = await tx.recurringClass.findFirst({
      where: { id: recurringClassId },
    });

    return recurringClass;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch recurring class.");
  }
};

// Delete the recurring class.
export const deleteRecurringClass = async (
  tx: Prisma.TransactionClient,
  recurringClassId: number,
) => {
  try {
    // Fetch the classes to be deleted based on recurring class id.
    const classesToDelete = await tx.class.findMany({
      where: {
        recurringClassId,
      },
      select: { id: true },
    });

    const classIdsToDelete = classesToDelete.map((classObj) => classObj.id);

    // Delete class attendance associated with the class IDs.
    await tx.classAttendance.deleteMany({
      where: { classId: { in: classIdsToDelete } },
    });

    // Delete the classes themselves.
    await tx.class.deleteMany({
      where: { id: { in: classIdsToDelete } },
    });

    // Delete recurring class attendance associated with the recurring id.
    await tx.recurringClassAttendance.deleteMany({
      where: { recurringClassId },
    });

    // Delete the recurring class itself.
    const recurringClass = await tx.recurringClass.delete({
      where: { id: recurringClassId },
    });

    return recurringClass;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to delete the recurring class.");
  }
};
