import { useEffect, useState } from "react";
import { manilaDate } from "../../convex/lib/dates";

export { addDays, daysBetween, manilaDate } from "../../convex/lib/dates";

// Today's business date in Philippine time. Queries take it as an argument
// (instead of reading the clock on the server) so "late" updates at midnight.
export function useToday() {
  const [today, setToday] = useState(() => manilaDate());
  useEffect(() => {
    const timer = setInterval(() => setToday(manilaDate()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
