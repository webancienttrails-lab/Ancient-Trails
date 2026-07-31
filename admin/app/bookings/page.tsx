"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Ticket,
  Trash2,
  UserRoundCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { HeaderDateRangePicker } from "@/components/admin-dashboard/header-date-range-picker";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import {
  createAdminBooking,
  deleteAdminBooking,
  listAdminBookings,
  updateAdminBooking,
  type AdminBooking,
  type BookingAccommodationDetails,
  type BookingChildDetails,
  type BookingGuestDetails,
  type BookingPayload,
} from "@/lib/bookings";
import { listAdminTours, type AdminTour } from "@/lib/tours";
import { cn } from "@/lib/utils";

type BookingSheetMode = "add" | "view" | "edit";

type BookingMetric = {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  tone: string;
  trendTone: string;
};

type BookingFormGuestDetails = Omit<BookingGuestDetails, "dateOfBirth"> & {
  dateOfBirth: string;
};

type BookingFormChildDetails = {
  age: string;
};

type BookingFormAccommodationDetails = {
  [Key in keyof BookingAccommodationDetails]: string;
};

type BookingFormState = Omit<
  BookingPayload,
  | "totalGuest"
  | "adultCount"
  | "childCount"
  | "childDetails"
  | "guestDetails"
  | "accommodationDetails"
> & {
  totalGuest: string;
  adultCount: string;
  childCount: string;
  childDetails: BookingFormChildDetails[];
  guestDetails: BookingFormGuestDetails[];
  accommodationDetails: BookingFormAccommodationDetails;
};

const titleOptions = ["Mr", "Mrs", "Ms", "Dr", "Prof"];
const genderOptions = ["Male", "Female", "Other"];
const countryCodeOptions = [
  "+91",
  "+1",
  "+44",
  "+61",
  "+971",
  "+65",
  "+94",
  "+977",
  "+880",
];

function createEmptyGuestDetails(): BookingFormGuestDetails {
  return {
    title: "Mr",
    firstName: "",
    lastName: "",
    countryCode: "+91",
    mobileNumber: "",
    email: "",
    dateOfBirth: "",
    gender: "Male",
    address: "",
  };
}

function createEmptyChildDetails(): BookingFormChildDetails {
  return {
    age: "",
  };
}

function createEmptyBookingForm(tourId = ""): BookingFormState {
  return {
    tourId,
    totalGuest: "1",
    adultCount: "1",
    childCount: "0",
    childDetails: [],
    guestDetails: [createEmptyGuestDetails()],
    accommodationDetails: {
      singleOccupancyOneRoom: "0",
      singleOccupancyTwoRooms: "0",
      doubleOccupancy: "0",
      twinOccupancy: "0",
      tripleOccupancy: "0",
    },
  };
}

const emptyBookingForm = createEmptyBookingForm();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function toWholeNumber(value: string): number {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(0, Math.trunc(parsedValue));
}

function toDateInputValue(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateToInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDatePickerValue(value: string): string {
  const date = parseDateInputValue(value);

  if (!date) {
    return "dd-mm-yyyy";
  }

  return formatDateWithDashes(date);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return formatDateWithDashes(date);
}

function formatDateWithDashes(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function getGuestName(guest?: BookingGuestDetails): string {
  if (!guest) {
    return "-";
  }

  const name = [guest.title, guest.firstName, guest.lastName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

  return name || "-";
}

function getBookingReference(booking: AdminBooking): string {
  return `BK-${booking.id.slice(-6).toUpperCase()}`;
}

function formatChildDetails(childDetails: BookingChildDetails[]): string {
  return childDetails.length
    ? childDetails.map((child) => child.age).join(", ")
    : "-";
}

function formatAccommodation(
  accommodation: BookingAccommodationDetails
): string {
  const entries = [
    ["Single 1R", accommodation.singleOccupancyOneRoom],
    ["Single 2R", accommodation.singleOccupancyTwoRooms],
    ["Double", accommodation.doubleOccupancy],
    ["Twin", accommodation.twinOccupancy],
    ["Triple", accommodation.tripleOccupancy],
  ].filter((entry): entry is [string, number] => Number(entry[1]) > 0);

  return entries.length
    ? entries.map(([label, value]) => `${label}: ${value}`).join(", ")
    : "-";
}

function getAccommodationUnitCount(
  accommodation: BookingAccommodationDetails
): number {
  return (
    accommodation.singleOccupancyOneRoom +
    accommodation.singleOccupancyTwoRooms +
    accommodation.doubleOccupancy +
    accommodation.twinOccupancy +
    accommodation.tripleOccupancy
  );
}

function resizeGuestDetails(
  guestDetails: BookingFormGuestDetails[],
  guestCount: number
): BookingFormGuestDetails[] {
  return Array.from({ length: guestCount }, (_item, index) => ({
    ...(guestDetails[index] || createEmptyGuestDetails()),
  }));
}

function resizeChildDetails(
  childDetails: BookingFormChildDetails[],
  childCount: number
): BookingFormChildDetails[] {
  return Array.from({ length: childCount }, (_item, index) => ({
    ...(childDetails[index] || createEmptyChildDetails()),
  }));
}

function bookingGuestToForm(
  guest?: BookingGuestDetails
): BookingFormGuestDetails {
  if (!guest) {
    return createEmptyGuestDetails();
  }

  return {
    title: guest.title,
    firstName: guest.firstName,
    lastName: guest.lastName,
    countryCode: guest.countryCode,
    mobileNumber: guest.mobileNumber,
    email: guest.email,
    dateOfBirth: toDateInputValue(guest.dateOfBirth),
    gender: guest.gender,
    address: guest.address,
  };
}

function bookingToForm(booking: AdminBooking): BookingFormState {
  return {
    tourId: booking.tourId,
    totalGuest: String(booking.totalGuest),
    adultCount: String(booking.adultCount),
    childCount: String(booking.childCount),
    childDetails: resizeChildDetails(
      booking.childDetails.map((child) => ({
        age: String(child.age),
      })),
      booking.childCount
    ),
    guestDetails: resizeGuestDetails(
      booking.guestDetails.map(bookingGuestToForm),
      booking.totalGuest
    ),
    accommodationDetails: {
      singleOccupancyOneRoom: String(
        booking.accommodationDetails.singleOccupancyOneRoom
      ),
      singleOccupancyTwoRooms: String(
        booking.accommodationDetails.singleOccupancyTwoRooms
      ),
      doubleOccupancy: String(booking.accommodationDetails.doubleOccupancy),
      twinOccupancy: String(booking.accommodationDetails.twinOccupancy),
      tripleOccupancy: String(booking.accommodationDetails.tripleOccupancy),
    },
  };
}

function createBookingPayload(form: BookingFormState): BookingPayload {
  const adultCount = toWholeNumber(form.adultCount);
  const childCount = toWholeNumber(form.childCount);
  const totalGuest = adultCount + childCount;

  return {
    tourId: form.tourId.trim(),
    totalGuest,
    adultCount,
    childCount,
    childDetails: Array.from({ length: childCount }, (_item, index) => ({
      age: toWholeNumber(form.childDetails[index]?.age || "0"),
    })),
    guestDetails: Array.from({ length: totalGuest }, (_item, index) => {
      const guest = form.guestDetails[index] || createEmptyGuestDetails();

      return {
        title: guest.title.trim(),
        firstName: guest.firstName.trim(),
        lastName: guest.lastName.trim(),
        countryCode: guest.countryCode.trim(),
        mobileNumber: guest.mobileNumber.trim(),
        email: guest.email.trim(),
        dateOfBirth: guest.dateOfBirth,
        gender: guest.gender.trim(),
        address: guest.address.trim(),
      };
    }),
    accommodationDetails: {
      singleOccupancyOneRoom: toWholeNumber(
        form.accommodationDetails.singleOccupancyOneRoom
      ),
      singleOccupancyTwoRooms: toWholeNumber(
        form.accommodationDetails.singleOccupancyTwoRooms
      ),
      doubleOccupancy: toWholeNumber(form.accommodationDetails.doubleOccupancy),
      twinOccupancy: toWholeNumber(form.accommodationDetails.twinOccupancy),
      tripleOccupancy: toWholeNumber(form.accommodationDetails.tripleOccupancy),
    },
  };
}

function createBookingMetrics(bookings: AdminBooking[]): BookingMetric[] {
  const totalGuests = bookings.reduce(
    (sum, booking) => sum + booking.totalGuest,
    0
  );
  const adultGuests = bookings.reduce(
    (sum, booking) => sum + booking.adultCount,
    0
  );
  const childGuests = bookings.reduce(
    (sum, booking) => sum + booking.childCount,
    0
  );
  const accommodationUnits = bookings.reduce(
    (sum, booking) => sum + getAccommodationUnitCount(booking.accommodationDetails),
    0
  );

  return [
    {
      label: "Total Bookings",
      value: bookings.length.toString(),
      trend: "Live booking records",
      icon: Ticket,
      tone: "bg-primary/10 text-primary",
      trendTone: "text-emerald-600",
    },
    {
      label: "Total Guests",
      value: totalGuests.toString(),
      trend: "Adults and children",
      icon: Users,
      tone: "bg-emerald-100 text-emerald-700",
      trendTone: "text-emerald-600",
    },
    {
      label: "Adult Guests",
      value: adultGuests.toString(),
      trend: "Adult count total",
      icon: UserRoundCheck,
      tone: "bg-amber-100 text-amber-700",
      trendTone: "text-amber-600",
    },
    {
      label: "Child Guests",
      value: childGuests.toString(),
      trend: `${accommodationUnits} accommodation units`,
      icon: Users,
      tone: "bg-violet-100 text-violet-700",
      trendTone: "text-violet-600",
    },
  ];
}

export default function BookingsPage() {
  const toast = useToast();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [tours, setTours] = useState<AdminTour[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [bookingSheetMode, setBookingSheetMode] =
    useState<BookingSheetMode | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(
    null
  );
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [isDeletingBookingId, setIsDeletingBookingId] = useState<string | null>(
    null
  );
  const [bookingForm, setBookingForm] =
    useState<BookingFormState>(emptyBookingForm);

  useEffect(() => {
    let isMounted = true;

    async function loadBookingData() {
      try {
        const [bookingsResponse, toursResponse] = await Promise.all([
          listAdminBookings(),
          listAdminTours(),
        ]);

        if (isMounted) {
          setBookings(bookingsResponse.data.bookings);
          setTours(toursResponse.data.tours);
        }
      } catch (error) {
        toast.error("Unable to load bookings", getErrorMessage(error));
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

  const filteredBookings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return bookings;
    }

    return bookings.filter((booking) => {
      const guestSearchValues = booking.guestDetails.flatMap((guest) => [
        getGuestName(guest),
        guest.email,
        guest.mobileNumber,
        guest.countryCode,
        guest.gender,
        guest.address,
      ]);

      return [
        getBookingReference(booking),
        booking.tourId,
        ...guestSearchValues,
        ...booking.childDetails.map((child) => child.age),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [bookings, searchQuery]);

  const bookingMetrics = useMemo(
    () => createBookingMetrics(bookings),
    [bookings]
  );
  const tourNameById = useMemo(
    () => new Map(tours.map((tour) => [tour.tourId, tour.tourName])),
    [tours]
  );
  const isBookingSheetOpen = bookingSheetMode !== null;

  function updateBookingForm<K extends keyof BookingFormState>(
    field: K,
    value: BookingFormState[K]
  ) {
    setBookingForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [field]: value,
      };

      if (field === "adultCount" || field === "childCount") {
        const adultCount = toWholeNumber(String(nextForm.adultCount));
        const childCount = toWholeNumber(String(nextForm.childCount));
        const totalGuest = adultCount + childCount;

        nextForm.totalGuest = String(totalGuest);
        nextForm.guestDetails = resizeGuestDetails(
          currentForm.guestDetails,
          totalGuest
        );
        nextForm.childDetails = resizeChildDetails(
          currentForm.childDetails,
          childCount
        );
      }

      return nextForm;
    });
  }

  function updateGuestDetails<K extends keyof BookingFormGuestDetails>(
    indexToUpdate: number,
    field: K,
    value: BookingFormGuestDetails[K]
  ) {
    setBookingForm((currentForm) => ({
      ...currentForm,
      guestDetails: currentForm.guestDetails.map((guest, index) =>
        index === indexToUpdate
          ? {
              ...guest,
              [field]: value,
            }
          : guest
      ),
    }));
  }

  function updateAccommodationDetails<
    K extends keyof BookingFormAccommodationDetails,
  >(field: K, value: BookingFormAccommodationDetails[K]) {
    setBookingForm((currentForm) => ({
      ...currentForm,
      accommodationDetails: {
        ...currentForm.accommodationDetails,
        [field]: value,
      },
    }));
  }

  function updateChildDetails(indexToUpdate: number, value: string) {
    setBookingForm((currentForm) => ({
      ...currentForm,
      childDetails: currentForm.childDetails.map((child, index) =>
        index === indexToUpdate
          ? {
              ...child,
              age: value,
            }
          : child
      ),
    }));
  }

  function openAddBookingSheet() {
    setSelectedBooking(null);
    setBookingForm(createEmptyBookingForm(tours[0]?.tourId || ""));
    setBookingSheetMode("add");
  }

  function openViewBookingSheet(booking: AdminBooking) {
    setSelectedBooking(booking);
    setBookingForm(bookingToForm(booking));
    setBookingSheetMode("view");
  }

  function openEditBookingSheet(booking: AdminBooking) {
    setSelectedBooking(booking);
    setBookingForm(bookingToForm(booking));
    setBookingSheetMode("edit");
  }

  function closeBookingSheet() {
    if (isSavingBooking) {
      return;
    }

    setBookingSheetMode(null);
    setSelectedBooking(null);
    setBookingForm(createEmptyBookingForm());
  }

  async function handleDeleteBooking(booking: AdminBooking) {
    const primaryGuest = booking.guestDetails[0];
    const shouldDelete = window.confirm(
      `Delete booking for ${getGuestName(primaryGuest)}?`
    );

    if (!shouldDelete) {
      return;
    }

    setIsDeletingBookingId(booking.id);

    try {
      const response = await deleteAdminBooking(booking.id);

      setBookings((currentBookings) =>
        currentBookings.filter(
          (currentBooking) => currentBooking.id !== booking.id
        )
      );
      toast.success("Booking deleted", response.message);
    } catch (error) {
      toast.error("Booking not deleted", getErrorMessage(error));
    } finally {
      setIsDeletingBookingId(null);
    }
  }

  async function handleSaveBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (bookingSheetMode === "view") {
      return;
    }

    setIsSavingBooking(true);

    const payload = createBookingPayload(bookingForm);

    try {
      if (bookingSheetMode === "edit" && selectedBooking) {
        const response = await updateAdminBooking(selectedBooking.id, payload);

        setBookings((currentBookings) =>
          currentBookings.map((booking) =>
            booking.id === selectedBooking.id ? response.data.booking : booking
          )
        );
        setBookingSheetMode(null);
        setSelectedBooking(null);
        setBookingForm(createEmptyBookingForm());
        toast.success("Booking updated", response.message);
        return;
      }

      const response = await createAdminBooking(payload);

      setBookings((currentBookings) => [
        response.data.booking,
        ...currentBookings,
      ]);
      setBookingSheetMode(null);
      setSelectedBooking(null);
      setBookingForm(createEmptyBookingForm());
      toast.success("Booking added", response.message);
    } catch (error) {
      toast.error(
        bookingSheetMode === "edit"
          ? "Booking not updated"
          : "Booking not saved",
        getErrorMessage(error)
      );
    } finally {
      setIsSavingBooking(false);
    }
  }

  return (
    <AdminDashboardShell activeLabel="Booking">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <AdminPageTopbar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />

        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
              Bookings
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              Manage tour booking guests and accommodation details.
            </p>
          </div>

          <Button
            type="button"
            onClick={openAddBookingSheet}
            className="h-10 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Add New Booking
          </Button>
        </section>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {bookingMetrics.map((metric) => (
            <BookingMetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <BookingFilters
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
          <BookingTable
            bookings={filteredBookings}
            isDeletingBookingId={isDeletingBookingId}
            isLoading={isLoadingBookings}
            onDelete={handleDeleteBooking}
            onEdit={openEditBookingSheet}
            onView={openViewBookingSheet}
            totalCount={bookings.length}
            tourNameById={tourNameById}
          />
        </section>
      </div>

      <BookingFormDialog
        form={bookingForm}
        isBusy={isSavingBooking}
        isOpen={isBookingSheetOpen}
        isSaving={isSavingBooking}
        mode={bookingSheetMode}
        onAccommodationUpdate={updateAccommodationDetails}
        onChildDetailsUpdate={updateChildDetails}
        onClose={closeBookingSheet}
        onGuestUpdate={updateGuestDetails}
        onSubmit={handleSaveBooking}
        onUpdate={updateBookingForm}
        tours={tours}
      />
    </AdminDashboardShell>
  );
}

function AdminPageTopbar({
  searchQuery,
  onSearchQueryChange,
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}) {
  const toast = useToast();

  return (
    <header className="hidden flex-col gap-4 border-b border-border pb-4 md:flex xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle className="size-9 rounded-sm" />

        <div className="min-w-0">
          <h2 className="font-sans text-lg font-bold tracking-normal">
            Bookings
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">Bookings</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            className="h-10 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
            placeholder="Search bookings..."
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>

        <HeaderDateRangePicker />

        <button
          onClick={() =>
            toast.info("Notifications", "You have 5 booking notifications.")
          }
          className="relative grid size-10 place-items-center rounded-sm border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary"
          type="button"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
            5
          </span>
        </button>

        <button
          onClick={() =>
            toast.info("Admin profile", "Profile menu will open here.")
          }
          className="flex h-10 items-center gap-2 rounded-sm border border-border bg-white px-2.5 text-sm font-semibold transition-colors hover:border-primary"
          type="button"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#7a3b22] text-xs font-bold text-white">
            AU
          </span>
          <span className="hidden sm:inline">Admin User</span>
          <ChevronDown className="size-4 text-foreground/45" />
        </button>
      </div>
    </header>
  );
}

function BookingMetricCard({ metric }: { metric: BookingMetric }) {
  const Icon = metric.icon;

  return (
    <div className="rounded-sm border border-border bg-white p-4 shadow-sm shadow-stone-200/40">
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
          <p className={cn("mt-2 text-[11px] font-semibold", metric.trendTone)}>
            {metric.trend}
          </p>
        </div>
      </div>
    </div>
  );
}

function BookingFilters({
  searchQuery,
  onSearchQueryChange,
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
      <label className="relative min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          className="h-9 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
          placeholder="Search bookings..."
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </label>
    </div>
  );
}

function BookingTable({
  bookings,
  isDeletingBookingId,
  isLoading,
  onDelete,
  onEdit,
  onView,
  totalCount,
  tourNameById,
}: {
  bookings: AdminBooking[];
  isDeletingBookingId: string | null;
  isLoading: boolean;
  onDelete: (booking: AdminBooking) => void;
  onEdit: (booking: AdminBooking) => void;
  onView: (booking: AdminBooking) => void;
  totalCount: number;
  tourNameById: Map<string, string>;
}) {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[11%]" />
            <col className="w-[25%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-2 py-3 font-bold">Booking</th>
              <th className="px-2 py-3 font-bold">Guest Details</th>
              <th className="px-2 py-3 font-bold">Tour ID</th>
              <th className="px-2 py-3 font-bold">Guests</th>
              <th className="px-2 py-3 font-bold">Child Ages</th>
              <th className="px-2 py-3 font-bold">Accommodation</th>
              <th className="px-2 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={7}
                >
                  Loading bookings...
                </td>
              </tr>
            ) : null}

            {!isLoading && bookings.length === 0 ? (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={7}
                >
                  No bookings added yet.
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

                  return (
                    <tr
                      key={booking.id}
                      className="border-t border-border transition-colors hover:bg-muted/25"
                    >
                    <td
                      data-label="Booking"
                      data-mobile-inline
                      className="px-2 py-3 text-xs font-semibold text-foreground/70"
                    >
                      <span className="block truncate">
                        {getBookingReference(booking)}
                      </span>
                      <span className="mt-1 block truncate text-[10px] font-normal text-foreground/45">
                        {formatDate(booking.createdAt)}
                      </span>
                    </td>
                    <td
                      data-label="Guest Details"
                      data-mobile-primary
                      className="px-2 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">
                          {getGuestName(primaryGuest)}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-foreground/50">
                          {primaryGuest
                            ? `${primaryGuest.countryCode} ${primaryGuest.mobileNumber}`
                            : "-"}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-foreground/50">
                          {primaryGuest?.email || "-"}
                        </p>
                        {extraGuestCount ? (
                          <p className="mt-1 truncate text-[10px] font-semibold text-primary">
                            +{extraGuestCount} more guest
                            {extraGuestCount === 1 ? "" : "s"}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td
                      data-label="Tour ID"
                      data-mobile-split
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {booking.tourId}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {tourNameById.get(booking.tourId) || "-"}
                      </span>
                    </td>
                    <td
                      data-label="Guests"
                      data-mobile-split
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {booking.totalGuest} total
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {booking.adultCount} adult / {booking.childCount} child
                      </span>
                    </td>
                    <td
                      data-label="Child Ages"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate">
                        {formatChildDetails(booking.childDetails)}
                      </span>
                    </td>
                    <td
                      data-label="Accommodation"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="line-clamp-2">
                        {formatAccommodation(booking.accommodationDetails)}
                      </span>
                    </td>
                    <td data-actions data-label="Actions" className="px-2 py-3">
                      <BookingActionsMenu
                        booking={booking}
                        isDeleting={isDeletingBookingId === booking.id}
                        onDelete={onDelete}
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

      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-foreground/55">
          Showing {bookings.length ? `1 to ${bookings.length}` : "0"} of{" "}
          {totalCount} bookings
        </p>
        <div className="flex items-center gap-2">
          <PaginationButton label="Previous" disabled>
            <ChevronDown className="size-4 rotate-90" />
          </PaginationButton>
          <PaginationButton label="Page 1" active>
            1
          </PaginationButton>
          <PaginationButton label="Next" disabled>
            <ChevronDown className="size-4 -rotate-90" />
          </PaginationButton>
        </div>
      </div>
    </>
  );
}

function BookingActionsMenu({
  booking,
  isDeleting,
  onDelete,
  onEdit,
  onView,
}: {
  booking: AdminBooking;
  isDeleting: boolean;
  onDelete: (booking: AdminBooking) => void;
  onEdit: (booking: AdminBooking) => void;
  onView: (booking: AdminBooking) => void;
}) {
  const primaryGuest = booking.guestDetails[0];

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border bg-white text-foreground/65 transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              aria-label={`Open actions for ${getGuestName(primaryGuest)}`}
              disabled={isDeleting}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-36 rounded-sm border border-border bg-white p-1 shadow-lg shadow-stone-200/70"
        >
          <DropdownMenuItem
            onClick={() => onView(booking)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onEdit(booking)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-primary" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(booking)}
            variant="destructive"
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Trash2 className="size-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function BookingFormDialog({
  form,
  isBusy,
  isOpen,
  isSaving,
  mode,
  onAccommodationUpdate,
  onChildDetailsUpdate,
  onClose,
  onGuestUpdate,
  onSubmit,
  onUpdate,
  tours,
}: {
  form: BookingFormState;
  isBusy: boolean;
  isOpen: boolean;
  isSaving: boolean;
  mode: BookingSheetMode | null;
  onAccommodationUpdate: <K extends keyof BookingFormAccommodationDetails>(
    field: K,
    value: BookingFormAccommodationDetails[K]
  ) => void;
  onChildDetailsUpdate: (index: number, value: string) => void;
  onClose: () => void;
  onGuestUpdate: <K extends keyof BookingFormGuestDetails>(
    index: number,
    field: K,
    value: BookingFormGuestDetails[K]
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof BookingFormState>(
    field: K,
    value: BookingFormState[K]
  ) => void;
  tours: AdminTour[];
}) {
  const isReadOnly = mode === "view";
  const sheetTitle =
    mode === "edit"
      ? "Edit Booking"
      : mode === "view"
        ? "View Booking"
        : "Add Booking";
  const sheetDescription =
    mode === "edit"
      ? "Update the booking guest and accommodation details."
      : mode === "view"
        ? "Review the booking guest and accommodation details."
        : "Add a booking with linked tour and guest details.";
  const submitButtonLabel = isSaving
    ? "Saving..."
    : mode === "edit"
      ? "Update Booking"
      : "Save Booking";
  const inputClassName =
    "h-11 rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
  const textareaClassName =
    "min-h-24 rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 border-l border-border bg-white p-0 shadow-2xl shadow-stone-900/20 duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] data-[side=right]:w-full data-[side=right]:sm:max-w-[760px]"
      >
        <form
          onSubmit={onSubmit}
          className="flex h-full min-h-0 flex-col bg-white"
        >
          <SheetHeader className="border-b border-border px-7 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SheetTitle className="font-sans text-xl font-bold tracking-normal text-foreground">
                  {sheetTitle}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs text-foreground/55">
                  {sheetDescription}
                </SheetDescription>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="grid size-8 shrink-0 place-items-center rounded-sm border border-emerald-600 bg-white text-emerald-700 transition-colors hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Close booking form"
              >
                <X className="size-4" />
              </button>
            </div>
          </SheetHeader>

          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-7 py-6 sm:grid-cols-2">
            <FormSectionTitle>Booking Details</FormSectionTitle>

            <FormField label="Tour ID" required>
              <Select
                disabled={isReadOnly || tours.length === 0}
                name="tourId"
                required
                value={form.tourId}
                onValueChange={(value) => onUpdate("tourId", String(value || ""))}
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue
                    placeholder={
                      tours.length ? "Select tour" : "No tours available"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {tours.length ? (
                    tours.map((tour) => (
                      <SelectItem key={tour.id} value={tour.tourId}>
                        <span className="flex min-w-max flex-col gap-0.5">
                          <span className="whitespace-nowrap">
                            {tour.tourId}
                          </span>
                          <span className="whitespace-nowrap text-xs font-medium text-foreground/55">
                            {tour.tourName}
                          </span>
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="empty-tours">
                      No tours available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Total Guest" required>
              <input
                required
                readOnly
                type="number"
                value={form.totalGuest}
                className={inputClassName}
              />
            </FormField>

            <FormField label="Adult Count" required>
              <input
                required
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.adultCount}
                onChange={(event) => onUpdate("adultCount", event.target.value)}
                className={inputClassName}
              />
            </FormField>

            <FormField label="Child Count" required>
              <input
                required
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.childCount}
                onChange={(event) => onUpdate("childCount", event.target.value)}
                className={inputClassName}
              />
            </FormField>

            {form.childDetails.length ? (
              <>
                <FormSectionTitle>Child Details</FormSectionTitle>
                <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                  {form.childDetails.map((child, index) => (
                    <FormField
                      key={index}
                      label={`Child ${index + 1} Age`}
                      required
                    >
                      <input
                        required
                        min={0}
                        max={17}
                        readOnly={isReadOnly}
                        type="number"
                        value={child.age}
                        onChange={(event) =>
                          onChildDetailsUpdate(index, event.target.value)
                        }
                        className={inputClassName}
                      />
                    </FormField>
                  ))}
                </div>
              </>
            ) : null}

            <FormSectionTitle>Guest Details</FormSectionTitle>

            <div className="grid gap-5 sm:col-span-2">
              {form.guestDetails.map((guest, index) => (
                <div
                  key={index}
                  className="grid gap-5 border-b border-border/80 pb-5 last:border-b-0 last:pb-0 sm:grid-cols-2"
                >
                  <div className="sm:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-normal text-foreground/55">
                      Guest {index + 1}
                    </p>
                  </div>

                  <FormField label="Title" required>
                    <Select
                      disabled={isReadOnly}
                      name={`guest-${index}-title`}
                      required
                      value={guest.title}
                      onValueChange={(value) =>
                        onGuestUpdate(index, "title", String(value || ""))
                      }
                    >
                      <SelectTrigger className={inputClassName}>
                        <SelectValue placeholder="Select title" />
                      </SelectTrigger>
                      <SelectContent>
                        {titleOptions.map((title) => (
                          <SelectItem key={title} value={title}>
                            {title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="First Name" required>
                    <input
                      required
                      readOnly={isReadOnly}
                      value={guest.firstName}
                      onChange={(event) =>
                        onGuestUpdate(index, "firstName", event.target.value)
                      }
                      className={inputClassName}
                      placeholder="Rahul"
                    />
                  </FormField>

                  <FormField label="Last Name" required>
                    <input
                      required
                      readOnly={isReadOnly}
                      value={guest.lastName}
                      onChange={(event) =>
                        onGuestUpdate(index, "lastName", event.target.value)
                      }
                      className={inputClassName}
                      placeholder="Sharma"
                    />
                  </FormField>

                  <FormField label="Country Code / Mobile" required>
                    <div className="grid gap-2 sm:grid-cols-[112px_1fr]">
                      <Select
                        disabled={isReadOnly}
                        name={`guest-${index}-country-code`}
                        required
                        value={guest.countryCode}
                        onValueChange={(value) =>
                          onGuestUpdate(
                            index,
                            "countryCode",
                            String(value || "")
                          )
                        }
                      >
                        <SelectTrigger className={inputClassName}>
                          <SelectValue placeholder="+91" />
                        </SelectTrigger>
                        <SelectContent>
                          {countryCodeOptions.map((countryCode) => (
                            <SelectItem key={countryCode} value={countryCode}>
                              {countryCode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input
                        required
                        readOnly={isReadOnly}
                        value={guest.mobileNumber}
                        onChange={(event) =>
                          onGuestUpdate(
                            index,
                            "mobileNumber",
                            event.target.value
                          )
                        }
                        className={inputClassName}
                        placeholder="9876543210"
                      />
                    </div>
                  </FormField>

                  <FormField label="Email" required>
                    <input
                      required
                      readOnly={isReadOnly}
                      type="email"
                      value={guest.email}
                      onChange={(event) =>
                        onGuestUpdate(index, "email", event.target.value)
                      }
                      className={inputClassName}
                      placeholder="guest@example.com"
                    />
                  </FormField>

                  <FormField label="Date of Birth" required>
                    <DatePicker
                      required
                      readOnly={isReadOnly}
                      showMonthYearDropdowns
                      value={guest.dateOfBirth}
                      onChange={(value) =>
                        onGuestUpdate(index, "dateOfBirth", value)
                      }
                      triggerClassName={inputClassName}
                    />
                  </FormField>

                  <FormField label="Gender" required>
                    <Select
                      disabled={isReadOnly}
                      name={`guest-${index}-gender`}
                      required
                      value={guest.gender}
                      onValueChange={(value) =>
                        onGuestUpdate(index, "gender", String(value || ""))
                      }
                    >
                      <SelectTrigger className={inputClassName}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {genderOptions.map((gender) => (
                          <SelectItem key={gender} value={gender}>
                            {gender}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField className="sm:col-span-2" label="Address" required>
                    <textarea
                      required
                      readOnly={isReadOnly}
                      value={guest.address}
                      onChange={(event) =>
                        onGuestUpdate(index, "address", event.target.value)
                      }
                      className={textareaClassName}
                      placeholder="House number, street, city, state, postal code"
                    />
                  </FormField>
                </div>
              ))}
            </div>

            <FormSectionTitle>Accommodation Details</FormSectionTitle>

            <FormField label="Single Occupancy with 1 Room">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.accommodationDetails.singleOccupancyOneRoom}
                onChange={(event) =>
                  onAccommodationUpdate(
                    "singleOccupancyOneRoom",
                    event.target.value
                  )
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Single Occupancy with 2 Rooms">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.accommodationDetails.singleOccupancyTwoRooms}
                onChange={(event) =>
                  onAccommodationUpdate(
                    "singleOccupancyTwoRooms",
                    event.target.value
                  )
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Double Occupancy">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.accommodationDetails.doubleOccupancy}
                onChange={(event) =>
                  onAccommodationUpdate("doubleOccupancy", event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Twin Occupancy">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.accommodationDetails.twinOccupancy}
                onChange={(event) =>
                  onAccommodationUpdate("twinOccupancy", event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Triple Occupancy">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.accommodationDetails.tripleOccupancy}
                onChange={(event) =>
                  onAccommodationUpdate("tripleOccupancy", event.target.value)
                }
                className={inputClassName}
              />
            </FormField>
          </div>

          {!isReadOnly ? (
            <SheetFooter className="border-t border-border bg-white px-7 py-6">
              <Button
                type="submit"
                disabled={isBusy}
                className="h-11 rounded-sm px-4 text-sm font-bold"
              >
                {submitButtonLabel}
              </Button>
            </SheetFooter>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
  );
}

function DatePicker({
  onChange,
  readOnly = false,
  required = false,
  showMonthYearDropdowns = false,
  triggerClassName,
  value,
}: {
  onChange: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
  showMonthYearDropdowns?: boolean;
  triggerClassName?: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = parseDateInputValue(value);
  const currentYear = new Date().getFullYear();

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!readOnly) {
          setIsOpen(open);
        }
      }}
    >
      <PopoverTrigger
        type="button"
        disabled={readOnly}
        aria-required={required}
        className={cn(
          triggerClassName,
          "flex w-full items-center justify-between gap-3 text-left font-medium",
          !value && "text-foreground/45"
        )}
      >
        <span>{formatDatePickerValue(value)}</span>
        <CalendarDays className="size-4 shrink-0 text-foreground/55" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="p-3">
        <Calendar
          key={value || "empty-date"}
          selected={selectedDate}
          showMonthYearDropdowns={showMonthYearDropdowns}
          yearRange={
            showMonthYearDropdowns
              ? {
                  from: currentYear - 120,
                  to: currentYear,
                }
              : undefined
          }
          onSelect={(date) => {
            onChange(dateToInputValue(date));
            setIsOpen(false);
          }}
          onClear={() => {
            onChange("");
            setIsOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function FormSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-border pb-2 sm:col-span-2">
      <h3 className="font-sans text-sm font-bold tracking-normal text-foreground">
        {children}
      </h3>
    </div>
  );
}

function FormField({
  children,
  className,
  label,
  required = false,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-2", className)}>
      <span className="text-xs font-bold uppercase tracking-normal text-foreground/55">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function PaginationButton({
  active = false,
  children,
  disabled = false,
  label,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-8 place-items-center rounded-sm border border-border bg-white text-xs font-bold text-foreground/60 transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-45",
        active && "border-primary bg-primary text-white hover:text-white"
      )}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}
