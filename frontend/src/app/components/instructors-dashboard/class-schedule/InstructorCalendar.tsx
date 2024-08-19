"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CalendarView from "@/app/components/CalendarView";
import styles from "./InstructorCalendar.module.scss";
import FullCalendar from "@fullcalendar/react";
import { CalendarApi } from "@fullcalendar/core/index.js";
import { getClassStartAndEndTimes } from "@/app/helper/dateUtils";
import { fetchClassesForCalendar } from "@/app/helper/classesApi";
import { fetchInstructorAvailabilitiesForTodayAndAfter } from "@/app/helper/instructorsApi";

function InstructorCalendar({
  id,
  name,
  isAdminAuthenticated,
}: {
  id: number | null;
  name?: string | null;
  isAdminAuthenticated?: boolean;
}) {
  const [allEvents, setAllEvents] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calendarRef = useRef<FullCalendar | null>(null);
  const instructorId = id ?? undefined;

  const fetchData = useCallback(async () => {
    if (instructorId === undefined) return;

    try {
      const classes: ClassForCalendar[] = await fetchClassesForCalendar(
        instructorId,
        "instructor",
      );

      // Display just 'booked', 'completed' classes, and 'canceledByInstructor' not 'canceledByCustomer' classes
      const classesToDisplay = classes.filter(
        (eachClass) =>
          eachClass.status === "booked" ||
          eachClass.status === "completed" ||
          eachClass.status === "canceledByInstructor",
      );

      const formattedClasses = classesToDisplay.map((eachClass) => {
        const { start, end } = getClassStartAndEndTimes(
          eachClass.dateTime,
          "Asia/Manila",
        );

        const color =
          eachClass.status === "booked"
            ? "#E7FBD9"
            : eachClass.status === "completed"
              ? "#B5C4AB"
              : "#FFEBE0";

        const childrenNames = eachClass.classAttendance.children
          .map((child) => child.name)
          .join(", ");

        return {
          classId: eachClass.id,
          start,
          end,
          title: childrenNames,
          color,
          classStatus: eachClass.status,
        };
      });

      const instructorAvailabilities: string[] =
        await fetchInstructorAvailabilitiesForTodayAndAfter(instructorId);

      const formattedAvailabilities = instructorAvailabilities.map(
        (availability) => {
          const { start, end } = getClassStartAndEndTimes(
            availability,
            "Asia/Manila",
          );

          return {
            start,
            end,
            title: "No booked class",
            color: "#A2B098",
          };
        },
      );

      setAllEvents([...formattedClasses, ...formattedAvailabilities]);
    } catch (error) {
      console.error("Failed to fetch classes:", error);
      setError("Failed to get classes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [instructorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (instructorId === undefined) return <></>;

  if (error) {
    return <div>{error}</div>;
  }

  return (
    // 'Page' is the parent component of 'CalendarHeader' and 'CalendarView' children components.
    // 'CalendarHeader' and 'CalendarView' are initially independent from each other, but 'Page' can connect them together
    // by passing 'calendarRef' to 'CalendarView' and retrieving the FullCalendar API instance from it and making the API available for 'CalendarHeader'using state
    <div className={styles.calendarContainer}>
      {isLoading && <div className={styles.loadingContainer}>Loading ...</div>}
      {!isLoading && !error && (
        <>
          {isAdminAuthenticated && name ? (
            <span className={styles.instructorName}>
              Instructor: &nbsp;{name}
            </span>
          ) : null}
          <CalendarView
            // Create a ref to access the FullCalendar instance in CalendarView;
            ref={calendarRef}
            events={allEvents}
            // TODO: Fetch holidays from the backend
            // holidays={["2024-07-29", "2024-07-30", "2024-07-31"]}
            instructorId={instructorId}
            isAdminAuthenticated={isAdminAuthenticated}
          />
        </>
      )}
      {error && <div>{error}</div>}
    </div>
  );
}

export default InstructorCalendar;
