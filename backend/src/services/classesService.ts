import { Prisma, Status } from "@prisma/client";
import { prisma } from "../../prisma/prismaClient";

// Fetch all the classes with related instructors and customers data
export const getAllClasses = async () => {
  try {
    const classes = await prisma.class.findMany({
      include: { instructor: true, customer: true },
      orderBy: { dateTime: "desc" },
    });

    return classes;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch classes.");
  }
};

// Fetch classes by customer id along with related instructors and customers data
export const getClassesByCustomerId = async (customerId: number) => {
  try {
    const classes = await prisma.class.findMany({
      where: { customerId },
      include: {
        instructor: true,
        customer: true,
        classAttendance: { include: { children: true } },
      },
      orderBy: { dateTime: "asc" },
    });

    return classes;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch classes.");
  }
};

// Create a new class in the DB
export const createClass = async (
  classData: {
    dateTime: string;
    instructorId: number;
    customerId: number;
    status: Status;
    subscriptionId: number;
    recurringClassId: number;
  },
  childrenIds: number[],
) => {
  try {
    const CreatedClass = await prisma.class.create({
      data: classData,
    });
    const classAttendancePromises = childrenIds.map((childrenId) => {
      return prisma.classAttendance.create({
        data: {
          classId: CreatedClass.id,
          childrenId,
        },
      });
    });
    const classAttendance = await Promise.all(classAttendancePromises);

    return { CreatedClass, classAttendance };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to add class.");
  }
};

// Delete a class in the DB
export const deleteClass = async (classId: number) => {
  try {
    await prisma.classAttendance.deleteMany({
      where: { classId },
    });
    const deletedClass = await prisma.class.delete({
      where: { id: classId },
    });

    return deletedClass;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to delete class.");
  }
};

// Check if a child has a booked class by the child's id
export const checkIfChildHasBookedClass = async (
  tx: Prisma.TransactionClient,
  childId: number,
): Promise<boolean> => {
  try {
    const bookedClass = await tx.classAttendance.findFirst({
      where: { childrenId: childId, class: { status: "booked" } },
    });

    // Return true if a booked class was found, otherwise false
    return bookedClass !== null;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to check if a child has a booked class.");
  }
};

// Check if a child has a completed class by the child's id
export const checkIfChildHasCompletedClass = async (
  tx: Prisma.TransactionClient,
  childId: number,
): Promise<boolean> => {
  try {
    const completedClass = await tx.classAttendance.findFirst({
      where: { childrenId: childId, class: { status: "completed" } },
    });

    // Return true if a completed class was found, otherwise false
    return completedClass !== null;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to check if a child has a completed class.");
  }
};

// Fetch a class by class id along with related instructors, customers, and children data
export const getClassById = async (classId: number) => {
  try {
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        instructor: true,
        customer: true,
        classAttendance: { include: { children: true } },
      },
    });

    return classData;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch a class.");
  }
};

// Update/Edit a class
export const updateClass = async (
  classId: number,
  dateTime?: string,
  instructorId?: number,
  childrenIds?: number[],
  status?:
    | "booked"
    | "completed"
    | "canceledByCustomer"
    | "canceledByInstructor",
  isRebookable?: boolean,
) => {
  try {
    const updatedClass = await prisma.$transaction(async (prisma) => {
      // Update the Class data
      const updatedClass = await prisma.class.update({
        where: { id: classId },
        data: {
          dateTime,
          instructorId,
          status,
          isRebookable,
        },
      });

      // Delete existing classAttendance records
      await prisma.classAttendance.deleteMany({
        where: { classId },
      });

      // Add new classAttendance records if childrenIds is provided
      if (childrenIds) {
        await prisma.classAttendance.createMany({
          data: childrenIds.map((childId) => ({
            classId,
            childrenId: childId,
          })),
        });
      }

      return updatedClass;
    });

    return updatedClass;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to update a class.");
  }
};

export async function countClassesOfSubscription(
  subscriptionId: number,
  until: Date,
) {
  try {
    return await prisma.class.count({
      where: {
        subscriptionId,
        OR: [{ status: "booked" }, { status: "completed" }],
        dateTime: { lte: until },
      },
    });
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to count lessons.");
  }
}

// Fetches class data for the calendar based on user type (instructor or customer), including/excluding related details as needed.
export const getClassesForCalendar = async (
  userId: number,
  userType: "instructor" | "customer",
) => {
  try {
    const includeOptions = {
      instructor: userType === "customer",
      classAttendance: { include: { children: true } },
    };

    const whereCondition =
      userType === "instructor"
        ? { instructorId: userId }
        : { customerId: userId };

    const classes = await prisma.class.findMany({
      where: whereCondition,
      include: includeOptions,
      orderBy: { dateTime: "desc" },
    });

    return classes;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch classes.");
  }
};

// Cancel a class
export const cancelClassById = async (
  classId: number,
  isPastPrevDayDeadline: boolean,
) => {
  const classToUpdate = await prisma.class.findUnique({
    where: { id: classId },
  });

  if (!classToUpdate) {
    throw new Error("Class not found");
  }

  if (classToUpdate.status !== "booked") {
    throw new Error("Class cannot be canceled");
  }

  // Use a transaction to ensure both operations succeed or fail together
  await prisma.$transaction(async (prisma) => {
    // Delete class attendance records
    await prisma.classAttendance.deleteMany({
      where: { classId },
    });
    // If classes are canceled before the class dates (!isPastPrevDayDeadline), they can be rescheduled (isRebookable: true).
    // Otherwise (isPastPrevDayDeadline), not (isRebookable: false)
    if (!isPastPrevDayDeadline) {
      await prisma.class.update({
        where: { id: classId },
        data: { status: "canceledByCustomer" },
      });
    } else {
      await prisma.class.update({
        where: { id: classId },
        data: { status: "canceledByCustomer", isRebookable: false },
      });
    }
  });
};

export const fetchInstructorClasses = async (instructorId: number) => {
  try {
    const classes = await prisma.class.findMany({
      where: { instructorId },
      include: {
        instructor: true,
        customer: {
          include: {
            children: true,
          },
        },
        classAttendance: { include: { children: true } },
      },
      orderBy: { dateTime: "asc" },
    });

    return classes;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch classes.");
  }
};

// Create classes based on the recurring class id
export const createClassesUsingRecurringClassId = async (
  tx: Prisma.TransactionClient,
  recurringClassId: number,
  instructorId: number,
  customerId: number,
  subscriptionId: number,
  childrenIds: number[],
  dateTimes: Date[],
) => {
  try {
    const createdClasses = await tx.class.createManyAndReturn({
      data: dateTimes.map((dateTime) => {
        return {
          recurringClassId,
          instructorId,
          customerId,
          subscriptionId,
          status: "booked",
          dateTime,
        };
      }),
    });

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

    return { createdClasses };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to add classes.");
  }
};

export const getExcludedClasses = async (
  tx: Prisma.TransactionClient,
  recurringClassIds: number[],
  date: Date,
) => {
  try {
    const excludedClassData = await tx.class.findMany({
      where: {
        recurringClassId: { in: recurringClassIds },
        dateTime: { gte: date },
      },
    });

    return excludedClassData;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch classes.");
  }
};

// Check if the instructor is already booked at the specified date and time
export const isInstructorBooked = async (
  instructorId: number,
  dateTime: string,
): Promise<boolean> => {
  try {
    const existingBooking = await prisma.class.findFirst({
      where: {
        instructorId,
        dateTime: new Date(dateTime),
        NOT: {
          status: "canceledByCustomer", // if the class status is 'canceledByCustomer, which means the time slot is available (not booked)
        },
      },
    });
    return existingBooking !== null;
  } catch (error) {
    console.error("Error checking instructor booking:", error);
    throw new Error("Failed to check instructor availability.");
  }
};

// Check if the selected children have another class with another instructor at the same dateTime
// If there are conflicting classes, return the array of the children's names
export const checkForChildrenWithConflictingClasses = async (
  dateTime: Date,
  childrenIds: number[],
) => {
  try {
    const conflictingClasses = await prisma.class.findMany({
      where: {
        dateTime,
        classAttendance: {
          some: {
            childrenId: {
              in: childrenIds,
            },
          },
        },
      },
      include: {
        classAttendance: {
          include: {
            children: true,
          },
        },
      },
    });

    // Filter out names of the selected children that have conflicts
    const childrenWithConflictingClasses: string[] = conflictingClasses.flatMap(
      (eachClass) =>
        eachClass.classAttendance
          .filter((attendance) => childrenIds.includes(attendance.childrenId))
          .map((attendance) => attendance.children.name),
    );

    return childrenWithConflictingClasses;
  } catch (error) {
    console.error("Service Error:", error);
    throw new Error("Failed to check for conflicting classes.");
  }
};

// Check if there is a class that is already booked at the same dateTime as the newlly booked class
export const checkDoubleBooking = async (
  customerId: number,
  dateTime: Date,
): Promise<boolean> => {
  try {
    const alreadyBookedClass = await prisma.class.findFirst({
      where: {
        customerId,
        dateTime,
        status: "booked",
      },
    });

    // Return true if a booked class is found, otherwise false
    return alreadyBookedClass !== null;
  } catch (error) {
    console.error("Service Error:", error);
    throw new Error("Failed to check class booking.");
  }
};
