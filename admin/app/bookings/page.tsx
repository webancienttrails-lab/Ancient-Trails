"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Ticket,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useToast } from "@/components/ui/toast";

import {
  archiveAdminBooking,
  listAdminBookings,
  type AdminBooking,
  type BookingGuestDetails,
} from "@/lib/bookings";

import {
  listAdminTours,
  type AdminTour,
} from "@/lib/tours";

import { cn } from "@/lib/utils";

/* =========================================================
   TYPES
========================================================= */

type BookingMetric = {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  descriptionTone: string;
};

/* =========================================================
   HELPERS
========================================================= */

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function getGuestName(
  guest?: BookingGuestDetails
): string {
  if (!guest) {
    return "-";
  }

  const name = [
    guest.title,
    guest.firstName,
    guest.lastName,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");

  return name || "-";
}

function getBookingReference(
  booking: AdminBooking
): string {
  return `BK-${booking.id.slice(-6).toUpperCase()}`;
}

function toMoney(
  value: number | null | undefined
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(Number(value)));
}

function formatCurrency(
  value: number,
  currency = "INR"
): string {
  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(toMoney(value));
}

/* =========================================================
   PAYMENT HELPERS
========================================================= */

function getBookingTotalAmount(
  booking: AdminBooking
): number {
  const grandTotal = toMoney(booking.grandTotal);

  if (grandTotal > 0) {
    return grandTotal;
  }

  const paidAmount =
    toMoney(booking.amountPaid) ||
    toMoney(booking.depositAmount);

  const balanceAmount = Number.isFinite(
    booking.balanceAmount
  )
    ? toMoney(booking.balanceAmount)
    : 0;

  const calculatedTotal =
    paidAmount + balanceAmount;

  if (calculatedTotal > 0) {
    return calculatedTotal;
  }

  return (
    toMoney(booking.subtotal) ||
    paidAmount
  );
}

function getBookingPaidAmount(
  booking: AdminBooking
): number {
  const amountPaid = toMoney(
    booking.amountPaid
  );

  if (amountPaid > 0) {
    return amountPaid;
  }

  const depositAmount = toMoney(
    booking.depositAmount
  );

  if (depositAmount > 0) {
    return depositAmount;
  }

  if (booking.paymentStatus === "paid") {
    return getBookingTotalAmount(booking);
  }

  return 0;
}

function getBookingDueAmount(
  booking: AdminBooking
): number {
  if (
    Number.isFinite(booking.balanceAmount)
  ) {
    return toMoney(booking.balanceAmount);
  }

  return Math.max(
    0,
    getBookingTotalAmount(booking) -
      getBookingPaidAmount(booking)
  );
}

/* =========================================================
   PAID / PENDING STATUS

   Only two statuses as requested.
========================================================= */

function getPaymentStatus(
  booking: AdminBooking
) {
  const totalAmount =
    getBookingTotalAmount(booking);

  const paidAmount =
    getBookingPaidAmount(booking);

  const dueAmount =
    getBookingDueAmount(booking);

  const isFullyPaid =
    totalAmount > 0 &&
    dueAmount <= 0 &&
    paidAmount >= totalAmount;

  if (
    booking.paymentStatus === "paid" &&
    dueAmount <= 0
  ) {
    return {
      label: "Paid",
      tone:
        "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  }

  if (isFullyPaid) {
    return {
      label: "Paid",
      tone:
        "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  }

  return {
    label: "Pending",
    tone:
      "bg-amber-100 text-amber-700 border-amber-200",
  };
}

/* =========================================================
   CURRENT MONTH
========================================================= */

function isCurrentMonth(
  dateValue: string
): boolean {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() ===
      now.getFullYear()
  );
}

/* =========================================================
   METRICS
========================================================= */

function createBookingMetrics(
  bookings: AdminBooking[]
): BookingMetric[] {
  const currentMonthBookings =
    bookings.filter((booking) =>
      isCurrentMonth(booking.createdAt)
    ).length;

  const fullyPaidBookings =
    bookings.filter((booking) => {
      return (
        getPaymentStatus(booking).label ===
        "Paid"
      );
    }).length;

  const balanceDueBookings =
    bookings.filter((booking) => {
      return (
        getBookingDueAmount(booking) > 0
      );
    }).length;

  return [
    {
      label: "Current Month Bookings",
      value:
        currentMonthBookings.toString(),
      description:
        "Bookings received this month",
      icon: CalendarDays,
      tone:
        "bg-orange-100 text-orange-600",
      descriptionTone:
        "text-orange-600",
    },
    {
      label: "Fully Paid Bookings",
      value:
        fullyPaidBookings.toString(),
      description:
        "Payment completed",
      icon: CheckCircle2,
      tone:
        "bg-emerald-100 text-emerald-700",
      descriptionTone:
        "text-emerald-600",
    },
    {
      label: "Balance Due Bookings",
      value:
        balanceDueBookings.toString(),
      description:
        "Bookings with pending balance",
      icon: WalletCards,
      tone:
        "bg-amber-100 text-amber-700",
      descriptionTone:
        "text-amber-600",
    },
    {
      label: "Total Bookings",
      value: bookings.length.toString(),
      description:
        "All active booking records",
      icon: Ticket,
      tone:
        "bg-primary/10 text-primary",
      descriptionTone:
        "text-primary",
    },
  ];
}

/* =========================================================
   PAGE
========================================================= */

export default function BookingsPage() {
  const router = useRouter();
  const toast = useToast();

  const [bookings, setBookings] =
    useState<AdminBooking[]>([]);

  const [tours, setTours] =
    useState<AdminTour[]>([]);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [
    isLoadingBookings,
    setIsLoadingBookings,
  ] = useState(true);

  const [
    isArchivingBookingId,
    setIsArchivingBookingId,
  ] = useState<string | null>(null);

  /* =======================================================
     LOAD BOOKINGS
  ======================================================= */

  useEffect(() => {
    let isMounted = true;

    async function loadBookingData() {
      try {
        const [
          bookingsResponse,
          toursResponse,
        ] = await Promise.all([
          listAdminBookings(),
          listAdminTours(),
        ]);

        if (!isMounted) {
          return;
        }

        setBookings(
          bookingsResponse.data.bookings
        );

        setTours(
          toursResponse.data.tours
        );
      } catch (error) {
        toast.error(
          "Unable to load bookings",
          getErrorMessage(error)
        );
      } finally {
        if (isMounted) {
          setIsLoadingBookings(false);
        }
      }
    }

    loadBookingData();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredBookings =
    useMemo(() => {
      const query = searchQuery
        .trim()
        .toLowerCase();

      if (!query) {
        return bookings;
      }

      return bookings.filter(
        (booking) => {
          const guestSearchValues =
            booking.guestDetails.flatMap(
              (guest) => [
                getGuestName(guest),
                guest.email,
                guest.mobileNumber,
                guest.countryCode,
                guest.gender,
                guest.address,
              ]
            );

          return [
            getBookingReference(
              booking
            ),
            booking.id,
            booking.tourId,
            ...guestSearchValues,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      );
    }, [bookings, searchQuery]);

  /* =======================================================
     METRICS
  ======================================================= */

  const bookingMetrics =
    useMemo(
      () =>
        createBookingMetrics(bookings),
      [bookings]
    );

  /* =======================================================
     TOUR MAP
  ======================================================= */

  const tourNameById = useMemo(
    () =>
      new Map(
        tours.map((tour) => [
          tour.tourId,
          tour.tourName,
        ])
      ),
    [tours]
  );

  /* =======================================================
     ROUTING

     Add / View / Edit are now separate inner pages.
  ======================================================= */

  function openAddBookingPage() {
    router.push("/bookings/add");
  }

  function openViewBookingPage(
    booking: AdminBooking
  ) {
    router.push(
      `/bookings/view?bookingId=${encodeURIComponent(
        booking.id
      )}`
    );
  }

  function openEditBookingPage(
    booking: AdminBooking
  ) {
    router.push(
      `/bookings/edit-booking?bookingId=${encodeURIComponent(
        booking.id
      )}`
    );
  }

  /* =======================================================
     ARCHIVE
  ======================================================= */

  async function handleArchiveBooking(
    booking: AdminBooking
  ) {
    const primaryGuest =
      booking.guestDetails[0];

    const shouldArchive =
      window.confirm(
        `Archive booking ${getBookingReference(
          booking
        )} for ${getGuestName(
          primaryGuest
        )}?`
      );

    if (!shouldArchive) {
      return;
    }

    setIsArchivingBookingId(
      booking.id
    );

    try {
      const response =
        await archiveAdminBooking(
          booking.id
        );

      setBookings(
        (currentBookings) =>
          currentBookings.filter(
            (currentBooking) =>
              currentBooking.id !==
              booking.id
          )
      );

      toast.success(
        "Booking archived",
        response.message ||
          "Booking archived successfully."
      );
    } catch (error) {
      toast.error(
        "Booking not archived",
        getErrorMessage(error)
      );
    } finally {
      setIsArchivingBookingId(null);
    }
  }

  return (
    <AdminDashboardShell
      activeLabel="Booking"
    >
      <div
        className={cn(
          "mx-auto flex w-full",
          "max-w-[1480px]",
          "flex-col gap-5"
        )}
      >
        {/* =============================================== */}
        {/* ACTION ROW */}
        {/* No separate page title/header */}
        {/* =============================================== */}

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            onClick={openAddBookingPage}
            className="h-10 rounded-sm px-4 text-xs font-bold"
          >
            <Plus
              className="size-4"
              data-icon="inline-start"
            />

            Add New Booking
          </Button>
        </section>

        {/* =============================================== */}
        {/* STATISTICS */}
        {/* =============================================== */}

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {bookingMetrics.map(
            (metric) => (
              <BookingMetricCard
                key={metric.label}
                metric={metric}
              />
            )
          )}
        </section>

        {/* =============================================== */}
        {/* BOOKING TABLE */}
        {/* =============================================== */}

        <section
          className={cn(
            "overflow-hidden rounded-sm",
            "border border-border",
            "bg-white",
            "shadow-sm shadow-stone-200/40"
          )}
        >
          <BookingFilters
            searchQuery={searchQuery}
            onSearchQueryChange={
              setSearchQuery
            }
          />

          <BookingTable
            bookings={filteredBookings}
            isArchivingBookingId={
              isArchivingBookingId
            }
            isLoading={
              isLoadingBookings
            }
            onArchive={
              handleArchiveBooking
            }
            onEdit={
              openEditBookingPage
            }
            onView={
              openViewBookingPage
            }
            totalCount={
              bookings.length
            }
            tourNameById={
              tourNameById
            }
          />
        </section>
      </div>
    </AdminDashboardShell>
  );
}

/* =========================================================
   METRIC CARD
========================================================= */

function BookingMetricCard({
  metric,
}: {
  metric: BookingMetric;
}) {
  const Icon = metric.icon;

  return (
    <div
      className={cn(
        "rounded-sm",
        "border border-border",
        "bg-white",
        "p-4",
        "shadow-sm shadow-stone-200/40"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full",
            metric.tone
          )}
        >
          <Icon className="size-6" />
        </span>

        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground/60">
            {metric.label}
          </p>

          <p className="mt-1 text-2xl font-bold leading-none text-foreground">
            {metric.value}
          </p>

          <p
            className={cn(
              "mt-2 text-[11px] font-semibold",
              metric.descriptionTone
            )}
          >
            {metric.description}
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   FILTERS

   Same outer padding:
   20px on all sides.
========================================================= */

function BookingFilters({
  searchQuery,
  onSearchQueryChange,
}: {
  searchQuery: string;
  onSearchQueryChange: (
    value: string
  ) => void;
}) {
  return (
    <div className="flex items-center border-b border-border p-5">
      <label className="relative w-full max-w-[360px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />

        <input
          className={cn(
            "h-10 w-full rounded-sm",
            "border border-border",
            "bg-white",
            "pl-9 pr-3",
            "text-xs font-medium",
            "outline-none",
            "transition-colors",
            "placeholder:text-foreground/40",
            "focus:border-primary",
            "focus:ring-3 focus:ring-primary/15"
          )}
          placeholder="Search booking ID, guest, tour..."
          type="search"
          value={searchQuery}
          onChange={(event) =>
            onSearchQueryChange(
              event.target.value
            )
          }
        />
      </label>
    </div>
  );
}

/* =========================================================
   BOOKING TABLE

   IMPORTANT:
   Every TH and TD uses:

   px-5 py-4

   Therefore:
   Left = 20px
   Right = 20px
   Top = 16px
   Bottom = 16px

   Consistent across the whole table.
========================================================= */

function BookingTable({
  bookings,
  isArchivingBookingId,
  isLoading,
  onArchive,
  onEdit,
  onView,
  totalCount,
  tourNameById,
}: {
  bookings: AdminBooking[];
  isArchivingBookingId:
    | string
    | null;
  isLoading: boolean;
  onArchive: (
    booking: AdminBooking
  ) => void;
  onEdit: (
    booking: AdminBooking
  ) => void;
  onView: (
    booking: AdminBooking
  ) => void;
  totalCount: number;
  tourNameById: Map<
    string,
    string
  >;
}) {
  return (
    <>
      <div className="w-full overflow-x-auto">
       <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
  {/* ============================================= */}
  {/* TABLE HEADER */}
  {/* ============================================= */}

  <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
    <tr className="border-b border-border">
      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        ID
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Date
      </th>

      <th className="border-r border-border px-5 py-4 font-bold last:border-r-0">
        Guest Details
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Tour ID
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Paid
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Due
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Status
      </th>

      <th className="whitespace-nowrap px-5 py-4 text-right font-bold">
        Actions
      </th>
    </tr>
  </thead>

  {/* ============================================= */}
  {/* TABLE BODY */}
  {/* ============================================= */}

  <tbody>
    {isLoading ? (
      <tr>
        <td
          colSpan={8}
          className="px-5 py-10 text-center text-xs text-foreground/55"
        >
          Loading bookings...
        </td>
      </tr>
    ) : null}

    {!isLoading && bookings.length === 0 ? (
      <tr>
        <td
          colSpan={8}
          className="px-5 py-10 text-center text-xs text-foreground/55"
        >
          No bookings found.
        </td>
      </tr>
    ) : null}

    {!isLoading
      ? bookings.map((booking) => {
          const primaryGuest = booking.guestDetails[0];

          const extraGuestCount = Math.max(
            booking.guestDetails.length - 1,
            0
          );

          const currency = booking.paymentCurrency || "INR";

          const paidAmount = getBookingPaidAmount(booking);

          const dueAmount = getBookingDueAmount(booking);

          const paymentStatus = getPaymentStatus(booking);

          const tourName = tourNameById.get(booking.tourId);

          return (
            <tr
              key={booking.id}
              className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/20"
            >
              {/* ID */}

              <td className="border-r border-border px-5 py-4 align-middle">
                <button
                  type="button"
                  onClick={() => onView(booking)}
                  className="whitespace-nowrap text-xs font-bold text-primary transition-colors hover:underline"
                >
                  {getBookingReference(booking)}
                </button>
              </td>

              {/* DATE */}

              <td className="whitespace-nowrap border-r border-border px-5 py-4 align-middle text-xs font-medium text-foreground/65">
                {formatDate(booking.createdAt)}
              </td>

              {/* GUEST DETAILS */}

              <td className="border-r border-border px-5 py-4 align-middle">
                <div className="min-w-[210px]">
                  <p className="font-bold text-foreground">
                    {getGuestName(primaryGuest)}
                  </p>

                  <p className="mt-1 text-[11px] text-foreground/50">
                    {primaryGuest
                      ? `${primaryGuest.countryCode} ${primaryGuest.mobileNumber}`
                      : "-"}
                  </p>

                  <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-foreground/50">
                    {primaryGuest?.email || "-"}
                  </p>

                  {extraGuestCount > 0 ? (
                    <p className="mt-1 text-[10px] font-semibold text-primary">
                      +{extraGuestCount} more guest
                      {extraGuestCount === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </div>
              </td>

              {/* TOUR ID */}

              <td className="border-r border-border px-5 py-4 align-middle">
                <div className="min-w-[130px]">
                  <p className="whitespace-nowrap text-xs font-bold text-foreground">
                    {booking.tourId}
                  </p>

                  {tourName ? (
                    <p className="mt-1 max-w-[180px] truncate text-[10px] text-foreground/50">
                      {tourName}
                    </p>
                  ) : null}
                </div>
              </td>

              {/* PAID */}

              <td className="whitespace-nowrap border-r border-border px-5 py-4 align-middle">
                <span className="text-xs font-bold text-emerald-600">
                  {formatCurrency(paidAmount, currency)}
                </span>
              </td>

              {/* DUE */}

              <td className="whitespace-nowrap border-r border-border px-5 py-4 align-middle">
                <span
                  className={cn(
                    "text-xs font-bold",
                    dueAmount > 0
                      ? "text-amber-600"
                      : "text-foreground/45"
                  )}
                >
                  {formatCurrency(dueAmount, currency)}
                </span>
              </td>

              {/* STATUS */}

              <td className="border-r border-border px-5 py-4 align-middle">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1",
                    "text-[10px] font-bold",
                    paymentStatus.tone
                  )}
                >
                  {paymentStatus.label}
                </span>
              </td>

              {/* ACTIONS */}

              <td className="px-5 py-4 align-middle">
                <BookingActionsMenu
                  booking={booking}
                  isArchiving={
                    isArchivingBookingId === booking.id
                  }
                  onArchive={onArchive}
                  onEdit={onEdit}
                  onView={onView}
                />
              </td>
            </tr>
          );
        })
      : null}
  </tbody>
</table>
      </div>

      {/* =============================================== */}
      {/* TABLE FOOTER */}
      {/* Same left/right padding as table */}
      {/* =============================================== */}

      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-foreground/55">
          Showing{" "}
          {bookings.length
            ? `1 to ${bookings.length}`
            : "0"}{" "}
          of {totalCount} bookings
        </p>

        <div className="flex items-center gap-2">
          <PaginationButton
            label="Previous"
            disabled
          >
            <ChevronDown className="size-4 rotate-90" />
          </PaginationButton>

          <PaginationButton
            label="Page 1"
            active
          >
            1
          </PaginationButton>

          <PaginationButton
            label="Next"
            disabled
          >
            <ChevronDown className="size-4 -rotate-90" />
          </PaginationButton>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   ACTION MENU

   Delete completely removed.
   Archive added instead.

   View/Edit navigate to inner pages.
========================================================= */

function BookingActionsMenu({
  booking,
  isArchiving,
  onArchive,
  onEdit,
  onView,
}: {
  booking: AdminBooking;
  isArchiving: boolean;
  onArchive: (
    booking: AdminBooking
  ) => void;
  onEdit: (
    booking: AdminBooking
  ) => void;
  onView: (
    booking: AdminBooking
  ) => void;
}) {
  const primaryGuest =
    booking.guestDetails[0];

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                "grid size-9 place-items-center rounded-full",
                "border border-border",
                "bg-white",
                "text-foreground/65",
                "transition-colors",
                "hover:border-primary",
                "hover:text-primary",
                "disabled:pointer-events-none",
                "disabled:opacity-50"
              )}
              aria-label={`Open actions for ${getGuestName(
                primaryGuest
              )}`}
              disabled={
                isArchiving
              }
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-40 rounded-sm border border-border bg-white p-1 shadow-lg shadow-stone-200/70"
        >
          {/* View */}

          <DropdownMenuItem
            onClick={() =>
              onView(booking)
            }
            className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />

            View
          </DropdownMenuItem>

          {/* Edit */}

          <DropdownMenuItem
            onClick={() =>
              onEdit(booking)
            }
            className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-primary" />

            Edit
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Archive */}

          <DropdownMenuItem
            onClick={() =>
              onArchive(
                booking
              )
            }
            disabled={
              isArchiving
            }
            className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold text-amber-700 focus:bg-amber-50 focus:text-amber-700"
          >
            <Archive className="size-4" />

            {isArchiving
              ? "Archiving..."
              : "Archive"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* =========================================================
   PAGINATION
========================================================= */

function PaginationButton({
  active = false,
  children,
  disabled = false,
  label,
}: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-8 place-items-center rounded-sm",
        "border border-border",
        "bg-white",
        "text-xs font-bold",
        "text-foreground/60",
        "transition-colors",
        "hover:border-primary",
        "hover:text-primary",
        "disabled:pointer-events-none",
        "disabled:opacity-45",

        active &&
          "border-primary bg-primary text-white hover:text-white"
      )}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}
