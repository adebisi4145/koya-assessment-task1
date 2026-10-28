import Link from "next/link";
import { buttonPrimary } from "./components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <p className="text-sm font-medium text-accent">Not found</p>
      <h1 className="mt-2 font-serif text-3xl tracking-tight">We couldn&apos;t find that page.</h1>
      <p className="mt-2 text-muted">
        If you followed a booking link, check that the reference is complete.
      </p>
      <Link href="/" className={`${buttonPrimary} mt-6`}>
        See available times
      </Link>
    </div>
  );
}
