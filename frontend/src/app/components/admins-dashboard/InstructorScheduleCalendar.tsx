import { useEffect, useState } from "react";
import ScheduleCalendar from "@/app/components/admins-dashboard/ScheduleCalendar";
import { SlotsOfDays } from "@/app/helper/instructorsApi";

import {
  getInstructorRecurringAvailability,
  addRecurringAvailabilities,
} from "@/app/helper/instructorsApi";

import {
  InstructorSelect,
  useInstructorSelect,
} from "@/app/components/admins-dashboard/InstructorSelect";

export default function InstructorScheduleCalendar() {
  const [instructors, selectedInstructorId, onSelectedInstructorIdChange] =
    useInstructorSelect();
  // TODO: set an appropriate default value.
  const [selectedDate, setSelectedDate] = useState("2024-07-01");
  const [startFrom, setStartFrom] = useState("2024-08-01");
  const [slots, setSlots] = useState<SlotsOfDays>({
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  });

  useEffect(() => {
    (async () => {
      const instructor = await getInstructorRecurringAvailability(
        selectedInstructorId,
        selectedDate,
      );
      if ("message" in instructor) {
        alert(instructor.message);
        return;
      }
      setSlots(instructor.recurringAvailabilities);
    })();
  }, [selectedInstructorId, selectedDate]);

  const save = async () => {
    await addRecurringAvailabilities(selectedInstructorId, slots, startFrom);
  };

  return (
    <>
      <InstructorSelect
        instructors={instructors}
        id={selectedInstructorId}
        onChange={onSelectedInstructorIdChange}
      />
      <label>
        Date
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </label>
      <ScheduleCalendar slotsOfDays={slots} setSlotsOfDays={setSlots} />
      <label>
        Start From
        <input
          type="date"
          value={startFrom}
          onChange={(e) => setStartFrom(e.target.value)}
        />
      </label>
      <button onClick={save}>Save</button>
    </>
  );
}
