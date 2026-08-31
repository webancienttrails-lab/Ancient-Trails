"use client";

import type { FormEvent, ReactNode } from "react";
import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Eye,
  Pencil,
  Save,
} from "lucide-react";

import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

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

import { useToast } from "@/components/ui/toast";

import {
  createAdminBooking,
  listAdminBookings,
  updateAdminBooking,
  type AdminBooking,
  type BookingAccommodationDetails,
  type BookingGuestDetails,
  type BookingPayload,
} from "@/lib/bookings";

import {
  listAdminTours,
  type AdminTour,
} from "@/lib/tours";

import { cn } from "@/lib/utils";

/* =========================================================
   TYPES
========================================================= */

type BookingPageMode =
  | "add"
  | "view"
  | "edit"
  | "invalid";

type BookingFormGuestDetails = Omit<
  BookingGuestDetails,
  "dateOfBirth"
> & {
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

/* =========================================================
   OPTIONS
========================================================= */

const titleOptions = [
  "Mr",
  "Mrs",
  "Ms",
  "Dr",
  "Prof",
];

const genderOptions = [
  "Male",
  "Female",
  "Other",
];

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

/* =========================================================
   EMPTY FORM
========================================================= */

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
    panNumber: "",
  };
}

function createEmptyChildDetails(): BookingFormChildDetails {
  return {
    age: "",
  };
}

function createEmptyBookingForm(
  tourId = ""
): BookingFormState {
  return {
    tourId,

    totalGuest: "1",
    adultCount: "1",
    childCount: "0",

    childDetails: [],

    guestDetails: [
      createEmptyGuestDetails(),
    ],

    accommodationDetails: {
      singleOccupancyOneRoom: "0",
      singleOccupancyTwoRooms: "0",
      doubleOccupancy: "0",
      twinOccupancy: "0",
      tripleOccupancy: "0",
    },
  };
}

/* =========================================================
   HELPERS
========================================================= */

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function toWholeNumber(
  value: string
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(parsed)
  );
}

function toDateInputValue(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateToInputValue(
  date: Date
): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInputValue(
  value: string
): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  return date;
}

function formatDatePickerValue(
  value: string
): string {
  const date =
    parseDateInputValue(value);

  if (!date) {
    return "dd-mm-yyyy";
  }

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  return `${day}-${month}-${date.getFullYear()}`;
}

function resizeGuestDetails(
  guests: BookingFormGuestDetails[],
  count: number
): BookingFormGuestDetails[] {
  return Array.from(
    { length: count },
    (_, index) => ({
      ...(
        guests[index] ||
        createEmptyGuestDetails()
      ),
    })
  );
}

function resizeChildDetails(
  children: BookingFormChildDetails[],
  count: number
): BookingFormChildDetails[] {
  return Array.from(
    { length: count },
    (_, index) => ({
      ...(
        children[index] ||
        createEmptyChildDetails()
      ),
    })
  );
}

/* =========================================================
   BOOKING -> FORM
========================================================= */

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

    countryCode:
      guest.countryCode,

    mobileNumber:
      guest.mobileNumber,

    email: guest.email,

    dateOfBirth:
      toDateInputValue(
        guest.dateOfBirth
      ),

    gender: guest.gender,
    address: guest.address,

    panNumber:
      guest.panNumber || "",
  };
}

function bookingToForm(
  booking: AdminBooking
): BookingFormState {
  return {
    tourId: booking.tourId,

    totalGuest: String(
      booking.totalGuest
    ),

    adultCount: String(
      booking.adultCount
    ),

    childCount: String(
      booking.childCount
    ),

    childDetails:
      resizeChildDetails(
        booking.childDetails.map(
          (child) => ({
            age: String(child.age),
          })
        ),
        booking.childCount
      ),

    guestDetails:
      resizeGuestDetails(
        booking.guestDetails.map(
          bookingGuestToForm
        ),
        booking.totalGuest
      ),

    accommodationDetails: {
      singleOccupancyOneRoom:
        String(
          booking
            .accommodationDetails
            .singleOccupancyOneRoom
        ),

      singleOccupancyTwoRooms:
        String(
          booking
            .accommodationDetails
            .singleOccupancyTwoRooms
        ),

      doubleOccupancy:
        String(
          booking
            .accommodationDetails
            .doubleOccupancy
        ),

      twinOccupancy:
        String(
          booking
            .accommodationDetails
            .twinOccupancy
        ),

      tripleOccupancy:
        String(
          booking
            .accommodationDetails
            .tripleOccupancy
        ),
    },
  };
}

/* =========================================================
   FORM -> PAYLOAD
========================================================= */

function createBookingPayload(
  form: BookingFormState
): BookingPayload {
  const adultCount =
    toWholeNumber(
      form.adultCount
    );

  const childCount =
    toWholeNumber(
      form.childCount
    );

  const totalGuest =
    adultCount + childCount;

  return {
    tourId:
      form.tourId.trim(),

    totalGuest,
    adultCount,
    childCount,

    childDetails:
      Array.from(
        {
          length:
            childCount,
        },
        (_, index) => ({
          age: toWholeNumber(
            form.childDetails[
              index
            ]?.age || "0"
          ),
        })
      ),

    guestDetails:
      Array.from(
        {
          length:
            totalGuest,
        },
        (_, index) => {
          const guest =
            form.guestDetails[
              index
            ] ||
            createEmptyGuestDetails();

          return {
            title:
              guest.title.trim(),

            firstName:
              guest.firstName.trim(),

            lastName:
              guest.lastName.trim(),

            countryCode:
              guest.countryCode.trim(),

            mobileNumber:
              guest.mobileNumber.trim(),

            email:
              guest.email.trim(),

            dateOfBirth:
              guest.dateOfBirth,

            gender:
              guest.gender.trim(),

            address:
              guest.address.trim(),

            panNumber:
              guest.panNumber?.trim() ||
              "",
          };
        }
      ),

    accommodationDetails: {
      singleOccupancyOneRoom:
        toWholeNumber(
          form
            .accommodationDetails
            .singleOccupancyOneRoom
        ),

      singleOccupancyTwoRooms:
        toWholeNumber(
          form
            .accommodationDetails
            .singleOccupancyTwoRooms
        ),

      doubleOccupancy:
        toWholeNumber(
          form
            .accommodationDetails
            .doubleOccupancy
        ),

      twinOccupancy:
        toWholeNumber(
          form
            .accommodationDetails
            .twinOccupancy
        ),

      tripleOccupancy:
        toWholeNumber(
          form
            .accommodationDetails
            .tripleOccupancy
        ),
    },
  };
}

/* =========================================================
   ROUTE DETECTION
========================================================= */

function getRouteDetails(
  slug: string[],
  queryMode: string | null,
  queryBookingId: string | null
): {
  mode: BookingPageMode;
  bookingId: string | null;
} {
  if (
    queryMode === "view" &&
    queryBookingId
  ) {
    return {
      mode: "view",
      bookingId: queryBookingId,
    };
  }

  if (
    queryMode === "edit" &&
    queryBookingId
  ) {
    return {
      mode: "edit",
      bookingId: queryBookingId,
    };
  }

  if (
    slug.length === 1 &&
    slug[0] === "view" &&
    queryBookingId
  ) {
    return {
      mode: "view",
      bookingId: queryBookingId,
    };
  }

  if (
    slug.length === 1 &&
    slug[0] === "edit-booking" &&
    queryBookingId
  ) {
    return {
      mode: "edit",
      bookingId: queryBookingId,
    };
  }

  /*
    /bookings/add
  */
  if (
    slug.length === 1 &&
    slug[0] === "add"
  ) {
    return {
      mode: "add",
      bookingId: null,
    };
  }

  /*
    /bookings/:id
  */
  if (
    slug.length === 1 &&
    slug[0] !== "add"
  ) {
    return {
      mode: "view",
      bookingId: slug[0],
    };
  }

  /*
    /bookings/:id/edit
  */
  if (
    slug.length === 2 &&
    slug[1] === "edit"
  ) {
    return {
      mode: "edit",
      bookingId: slug[0],
    };
  }

  /*
    /bookings/edit/:id
  */
  if (
    slug.length === 2 &&
    slug[0] === "edit"
  ) {
    return {
      mode: "edit",
      bookingId: slug[1],
    };
  }

  return {
    mode: "invalid",
    bookingId: null,
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function BookingInnerPage() {
  return (
    <Suspense fallback={null}>
      <BookingInnerPageContent />
    </Suspense>
  );
}

function BookingInnerPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const slug = useMemo(() => {
    const bookingsIndex =
      pathname
        .split("/")
        .filter(Boolean)
        .findIndex(
          (segment) =>
            segment === "bookings"
        );

    if (bookingsIndex < 0) {
      return [];
    }

    return pathname
      .split("/")
      .filter(Boolean)
      .slice(bookingsIndex + 1);
  }, [pathname]);

  const {
    mode,
    bookingId,
  } = useMemo(
    () =>
      getRouteDetails(
        slug,
        searchParams.get("mode"),
        searchParams.get("bookingId")
      ),
    [searchParams, slug]
  );

  const [
    bookingForm,
    setBookingForm,
  ] = useState<BookingFormState>(
    createEmptyBookingForm()
  );

  const [
    tours,
    setTours,
  ] =
    useState<AdminTour[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false);

  const [
    loadError,
    setLoadError,
  ] =
    useState("");

  const isReadOnly =
    mode === "view";

  /* =======================================================
     LOAD DATA
  ======================================================= */

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setIsLoading(true);
      setLoadError("");

      try {
        if (
          mode === "invalid"
        ) {
          setLoadError(
            "Invalid booking page."
          );

          return;
        }

        /*
          ADD
        */
        if (
          mode === "add"
        ) {
          const toursResponse =
            await listAdminTours();

          if (!isMounted) {
            return;
          }

          const loadedTours =
            toursResponse.data.tours;

          setTours(
            loadedTours
          );

          setBookingForm(
            createEmptyBookingForm(
              loadedTours[0]
                ?.tourId || ""
            )
          );

          return;
        }

        /*
          VIEW / EDIT
        */

        const [
          bookingsResponse,
          toursResponse,
        ] =
          await Promise.all([
            listAdminBookings(),
            listAdminTours(),
          ]);

        if (!isMounted) {
          return;
        }

        const loadedTours =
          toursResponse.data.tours;

        setTours(
          loadedTours
        );

        const booking =
          bookingsResponse.data.bookings.find(
            (item) =>
              item.id ===
              bookingId
          );

        if (!booking) {
          setLoadError(
            "Booking not found."
          );

          return;
        }

        setBookingForm(
          bookingToForm(
            booking
          )
        );
      } catch (error) {
        const message =
          getErrorMessage(
            error
          );

        setLoadError(
          message
        );

        toast.error(
          "Unable to load booking",
          message
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [
    bookingId,
    mode,
    toast,
  ]);

  /* =======================================================
     FORM UPDATES
  ======================================================= */

  function updateBookingForm<
    K extends keyof BookingFormState,
  >(
    field: K,
    value: BookingFormState[K]
  ) {
    setBookingForm(
      (currentForm) => {
        const nextForm = {
          ...currentForm,
          [field]: value,
        };

        if (
          field ===
            "adultCount" ||
          field ===
            "childCount"
        ) {
          const adultCount =
            toWholeNumber(
              String(
                nextForm.adultCount
              )
            );

          const childCount =
            toWholeNumber(
              String(
                nextForm.childCount
              )
            );

          const totalGuest =
            adultCount +
            childCount;

          nextForm.totalGuest =
            String(
              totalGuest
            );

          nextForm.guestDetails =
            resizeGuestDetails(
              currentForm.guestDetails,
              totalGuest
            );

          nextForm.childDetails =
            resizeChildDetails(
              currentForm.childDetails,
              childCount
            );
        }

        return nextForm;
      }
    );
  }

  function updateGuestDetails<
    K extends keyof BookingFormGuestDetails,
  >(
    indexToUpdate: number,
    field: K,
    value: BookingFormGuestDetails[K]
  ) {
    setBookingForm(
      (currentForm) => ({
        ...currentForm,

        guestDetails:
          currentForm.guestDetails.map(
            (
              guest,
              index
            ) =>
              index ===
              indexToUpdate
                ? {
                    ...guest,
                    [field]:
                      value,
                  }
                : guest
          ),
      })
    );
  }

  function updateChildDetails(
    indexToUpdate: number,
    value: string
  ) {
    setBookingForm(
      (currentForm) => ({
        ...currentForm,

        childDetails:
          currentForm.childDetails.map(
            (
              child,
              index
            ) =>
              index ===
              indexToUpdate
                ? {
                    ...child,
                    age: value,
                  }
                : child
          ),
      })
    );
  }

  function updateAccommodationDetails<
    K extends keyof BookingFormAccommodationDetails,
  >(
    field: K,
    value: BookingFormAccommodationDetails[K]
  ) {
    setBookingForm(
      (currentForm) => ({
        ...currentForm,

        accommodationDetails:
          {
            ...currentForm.accommodationDetails,

            [field]:
              value,
          },
      })
    );
  }

  /* =======================================================
     SAVE
  ======================================================= */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      mode === "view" ||
      mode === "invalid"
    ) {
      return;
    }

    const adultCount =
      toWholeNumber(
        bookingForm.adultCount
      );

    const childCount =
      toWholeNumber(
        bookingForm.childCount
      );

    if (
      adultCount +
        childCount <=
      0
    ) {
      toast.error(
        "Invalid guests",
        "At least one guest is required."
      );

      return;
    }

    setIsSaving(true);

    try {
      const payload =
        createBookingPayload(
          bookingForm
        );

      /*
        EDIT
      */
      if (
        mode === "edit" &&
        bookingId
      ) {
        const response =
          await updateAdminBooking(
            bookingId,
            payload
          );

        toast.success(
          "Booking updated",
          response.message
        );

        router.push(
          `/bookings/${response.data.booking.id}`
        );

        router.refresh();

        return;
      }

      /*
        ADD
      */

      const response =
        await createAdminBooking(
          payload
        );

      toast.success(
        "Booking added",
        response.message
      );

      router.push(
        `/bookings/${response.data.booking.id}`
      );

      router.refresh();
    } catch (error) {
      toast.error(
        mode === "edit"
          ? "Booking not updated"
          : "Booking not created",
        getErrorMessage(error)
      );
    } finally {
      setIsSaving(false);
    }
  }

  /* =======================================================
     TITLES
  ======================================================= */

  const cardTitle =
    mode === "add"
      ? "Add Booking"
      : mode === "edit"
        ? "Edit Booking"
        : "Booking Details";

  const cardDescription =
    mode === "add"
      ? "Create a new tour booking."
      : mode === "edit"
        ? "Update booking guest and accommodation details."
        : "Review complete booking information.";

  /* =======================================================
     INPUT STYLES
  ======================================================= */

  const inputClassName =
    "h-11 w-full rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

  const textareaClassName =
    "min-h-24 w-full rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

  return (
    <AdminDashboardShell
      activeLabel="Booking"
    >
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        {/* ================================================= */}
        {/* TOP ACTIONS */}
        {/* ================================================= */}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(
                "/bookings"
              )
            }
            className="h-10 rounded-sm border-border bg-white px-3 text-xs font-bold"
          >
            <ArrowLeft className="size-4" />
            Back to Bookings
          </Button>

          {mode === "view" &&
          bookingId ? (
            <Button
              type="button"
              onClick={() =>
                router.push(
                  `/bookings/edit-booking?bookingId=${encodeURIComponent(
                    bookingId
                  )}`
                )
              }
              className="h-10 rounded-sm px-4 text-xs font-bold"
            >
              <Pencil className="size-4" />
              Edit Booking
            </Button>
          ) : null}
        </div>

        {/* ================================================= */}
        {/* INVALID / ERROR */}
        {/* ================================================= */}

        {loadError ? (
          <section className="rounded-sm border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-bold text-red-700">
              {loadError}
            </p>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(
                  "/bookings"
                )
              }
              className="mt-4"
            >
              Back to Bookings
            </Button>
          </section>
        ) : null}

        {/* ================================================= */}
        {/* LOADING */}
        {/* ================================================= */}

        {isLoading &&
        !loadError ? (
          <section className="rounded-sm border border-border bg-white p-8 shadow-sm shadow-stone-200/40">
            <div className="space-y-4">
              <div className="h-5 w-44 animate-pulse rounded-sm bg-muted" />
              <div className="h-3 w-80 max-w-full animate-pulse rounded-sm bg-muted" />

              <div className="grid gap-4 pt-5 sm:grid-cols-2">
                {Array.from({
                  length: 8,
                }).map(
                  (_, index) => (
                    <div
                      key={
                        index
                      }
                      className="h-16 animate-pulse rounded-sm bg-muted"
                    />
                  )
                )}
              </div>
            </div>
          </section>
        ) : null}

        {/* ================================================= */}
        {/* BOOKING FORM */}
        {/* ================================================= */}

        {!isLoading &&
        !loadError ? (
          <form
            onSubmit={
              handleSubmit
            }
            className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40"
          >
            {/* CARD TITLE */}

            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  {mode ===
                  "view" ? (
                    <Eye className="size-5 text-primary" />
                  ) : mode ===
                    "edit" ? (
                    <Pencil className="size-5 text-primary" />
                  ) : (
                    <CalendarDays className="size-5 text-primary" />
                  )}

                  <h2 className="text-lg font-bold text-foreground">
                    {
                      cardTitle
                    }
                  </h2>
                </div>

                <p className="mt-1 text-xs text-foreground/55">
                  {
                    cardDescription
                  }
                </p>
              </div>
            </div>

            {/* FORM BODY */}

            <div className="grid gap-6 p-6 sm:grid-cols-2">
              {/* ======================================= */}
              {/* BOOKING DETAILS */}
              {/* ======================================= */}

              <FormSectionTitle>
                Booking Details
              </FormSectionTitle>

              <FormField
                label="Tour ID"
                required
              >
                <Select
                  disabled={
                    isReadOnly ||
                    tours.length ===
                      0
                  }
                  name="tourId"
                  required
                  value={
                    bookingForm.tourId
                  }
                  onValueChange={(
                    value
                  ) =>
                    updateBookingForm(
                      "tourId",
                      String(
                        value ||
                          ""
                      )
                    )
                  }
                >
                  <SelectTrigger
                    className={
                      inputClassName
                    }
                  >
                    <SelectValue
                      placeholder={
                        tours.length
                          ? "Select tour"
                          : "No tours available"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {tours.map(
                      (
                        tour
                      ) => (
                        <SelectItem
                          key={
                            tour.id
                          }
                          value={
                            tour.tourId
                          }
                        >
                          <span className="flex min-w-max flex-col gap-0.5">
                            <span>
                              {
                                tour.tourId
                              }
                            </span>

                            <span className="text-xs text-foreground/55">
                              {
                                tour.tourName
                              }
                            </span>
                          </span>
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                label="Total Guest"
                required
              >
                <input
                  type="number"
                  readOnly
                  value={
                    bookingForm.totalGuest
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>

              <FormField
                label="Adult Count"
                required
              >
                <input
                  required
                  min={0}
                  type="number"
                  readOnly={
                    isReadOnly
                  }
                  value={
                    bookingForm.adultCount
                  }
                  onChange={(
                    event
                  ) =>
                    updateBookingForm(
                      "adultCount",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>

              <FormField
                label="Child Count"
                required
              >
                <input
                  required
                  min={0}
                  type="number"
                  readOnly={
                    isReadOnly
                  }
                  value={
                    bookingForm.childCount
                  }
                  onChange={(
                    event
                  ) =>
                    updateBookingForm(
                      "childCount",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>

              {/* ======================================= */}
              {/* CHILD DETAILS */}
              {/* ======================================= */}

              {bookingForm
                .childDetails
                .length ? (
                <>
                  <FormSectionTitle>
                    Child Details
                  </FormSectionTitle>

                  <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                    {bookingForm.childDetails.map(
                      (
                        child,
                        index
                      ) => (
                        <FormField
                          key={
                            index
                          }
                          label={`Child ${
                            index +
                            1
                          } Age`}
                          required
                        >
                          <input
                            required
                            min={
                              0
                            }
                            max={
                              17
                            }
                            type="number"
                            readOnly={
                              isReadOnly
                            }
                            value={
                              child.age
                            }
                            onChange={(
                              event
                            ) =>
                              updateChildDetails(
                                index,
                                event
                                  .target
                                  .value
                              )
                            }
                            className={
                              inputClassName
                            }
                          />
                        </FormField>
                      )
                    )}
                  </div>
                </>
              ) : null}

              {/* ======================================= */}
              {/* GUEST DETAILS */}
              {/* ======================================= */}

              <FormSectionTitle>
                Guest Details
              </FormSectionTitle>

              <div className="grid gap-6 sm:col-span-2">
                {bookingForm.guestDetails.map(
                  (
                    guest,
                    index
                  ) => (
                    <div
                      key={
                        index
                      }
                      className="grid gap-5 rounded-sm border border-border bg-muted/10 p-5 sm:grid-cols-2"
                    >
                      <div className="sm:col-span-2">
                        <p className="text-xs font-bold uppercase text-foreground/55">
                          Guest{" "}
                          {index +
                            1}
                        </p>
                      </div>

                      <FormField
                        label="Title"
                        required
                      >
                        <Select
                          disabled={
                            isReadOnly
                          }
                          value={
                            guest.title
                          }
                          onValueChange={(
                            value
                          ) =>
                            updateGuestDetails(
                              index,
                              "title",
                              String(
                                value ||
                                  ""
                              )
                            )
                          }
                        >
                          <SelectTrigger
                            className={
                              inputClassName
                            }
                          >
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {titleOptions.map(
                              (
                                title
                              ) => (
                                <SelectItem
                                  key={
                                    title
                                  }
                                  value={
                                    title
                                  }
                                >
                                  {
                                    title
                                  }
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </FormField>

                      <FormField
                        label="First Name"
                        required
                      >
                        <input
                          required
                          readOnly={
                            isReadOnly
                          }
                          value={
                            guest.firstName
                          }
                          onChange={(
                            event
                          ) =>
                            updateGuestDetails(
                              index,
                              "firstName",
                              event
                                .target
                                .value
                            )
                          }
                          className={
                            inputClassName
                          }
                        />
                      </FormField>

                      <FormField
                        label="Last Name"
                        required
                      >
                        <input
                          required
                          readOnly={
                            isReadOnly
                          }
                          value={
                            guest.lastName
                          }
                          onChange={(
                            event
                          ) =>
                            updateGuestDetails(
                              index,
                              "lastName",
                              event
                                .target
                                .value
                            )
                          }
                          className={
                            inputClassName
                          }
                        />
                      </FormField>

                      <FormField
                        label="Mobile"
                        required
                      >
                        <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
                          <Select
                            disabled={
                              isReadOnly
                            }
                            value={
                              guest.countryCode
                            }
                            onValueChange={(
                              value
                            ) =>
                              updateGuestDetails(
                                index,
                                "countryCode",
                                String(
                                  value ||
                                    ""
                                )
                              )
                            }
                          >
                            <SelectTrigger
                              className={
                                inputClassName
                              }
                            >
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              {countryCodeOptions.map(
                                (
                                  code
                                ) => (
                                  <SelectItem
                                    key={
                                      code
                                    }
                                    value={
                                      code
                                    }
                                  >
                                    {
                                      code
                                    }
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>

                          <input
                            required
                            readOnly={
                              isReadOnly
                            }
                            value={
                              guest.mobileNumber
                            }
                            onChange={(
                              event
                            ) =>
                              updateGuestDetails(
                                index,
                                "mobileNumber",
                                event
                                  .target
                                  .value
                              )
                            }
                            className={
                              inputClassName
                            }
                          />
                        </div>
                      </FormField>

                      <FormField
                        label="Email"
                        required
                      >
                        <input
                          required
                          type="email"
                          readOnly={
                            isReadOnly
                          }
                          value={
                            guest.email
                          }
                          onChange={(
                            event
                          ) =>
                            updateGuestDetails(
                              index,
                              "email",
                              event
                                .target
                                .value
                            )
                          }
                          className={
                            inputClassName
                          }
                        />
                      </FormField>

                      <FormField
                        label="Date of Birth"
                        required
                      >
                        <DatePicker
                          value={
                            guest.dateOfBirth
                          }
                          readOnly={
                            isReadOnly
                          }
                          onChange={(
                            value
                          ) =>
                            updateGuestDetails(
                              index,
                              "dateOfBirth",
                              value
                            )
                          }
                          triggerClassName={
                            inputClassName
                          }
                        />
                      </FormField>

                      <FormField
                        label="Gender"
                        required
                      >
                        <Select
                          disabled={
                            isReadOnly
                          }
                          value={
                            guest.gender
                          }
                          onValueChange={(
                            value
                          ) =>
                            updateGuestDetails(
                              index,
                              "gender",
                              String(
                                value ||
                                  ""
                              )
                            )
                          }
                        >
                          <SelectTrigger
                            className={
                              inputClassName
                            }
                          >
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {genderOptions.map(
                              (
                                gender
                              ) => (
                                <SelectItem
                                  key={
                                    gender
                                  }
                                  value={
                                    gender
                                  }
                                >
                                  {
                                    gender
                                  }
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </FormField>

                      <FormField
                        label="PAN Number"
                      >
                        <input
                          readOnly={
                            isReadOnly
                          }
                          value={
                            guest.panNumber ||
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateGuestDetails(
                              index,
                              "panNumber",
                              event
                                .target
                                .value
                            )
                          }
                          className={
                            inputClassName
                          }
                        />
                      </FormField>

                      <FormField
                        className="sm:col-span-2"
                        label="Address"
                        required
                      >
                        <textarea
                          required
                          readOnly={
                            isReadOnly
                          }
                          value={
                            guest.address
                          }
                          onChange={(
                            event
                          ) =>
                            updateGuestDetails(
                              index,
                              "address",
                              event
                                .target
                                .value
                            )
                          }
                          className={
                            textareaClassName
                          }
                        />
                      </FormField>
                    </div>
                  )
                )}
              </div>

              {/* ======================================= */}
              {/* ACCOMMODATION */}
              {/* ======================================= */}

              <FormSectionTitle>
                Accommodation Details
              </FormSectionTitle>

              <FormField label="Single Occupancy - 1 Room">
                <input
                  min={0}
                  type="number"
                  readOnly={
                    isReadOnly
                  }
                  value={
                    bookingForm
                      .accommodationDetails
                      .singleOccupancyOneRoom
                  }
                  onChange={(
                    event
                  ) =>
                    updateAccommodationDetails(
                      "singleOccupancyOneRoom",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>

              <FormField label="Single Occupancy - 2 Rooms">
                <input
                  min={0}
                  type="number"
                  readOnly={
                    isReadOnly
                  }
                  value={
                    bookingForm
                      .accommodationDetails
                      .singleOccupancyTwoRooms
                  }
                  onChange={(
                    event
                  ) =>
                    updateAccommodationDetails(
                      "singleOccupancyTwoRooms",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>

              <FormField label="Double Occupancy">
                <input
                  min={0}
                  type="number"
                  readOnly={
                    isReadOnly
                  }
                  value={
                    bookingForm
                      .accommodationDetails
                      .doubleOccupancy
                  }
                  onChange={(
                    event
                  ) =>
                    updateAccommodationDetails(
                      "doubleOccupancy",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>

              <FormField label="Twin Occupancy">
                <input
                  min={0}
                  type="number"
                  readOnly={
                    isReadOnly
                  }
                  value={
                    bookingForm
                      .accommodationDetails
                      .twinOccupancy
                  }
                  onChange={(
                    event
                  ) =>
                    updateAccommodationDetails(
                      "twinOccupancy",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>

              <FormField label="Triple Occupancy">
                <input
                  min={0}
                  type="number"
                  readOnly={
                    isReadOnly
                  }
                  value={
                    bookingForm
                      .accommodationDetails
                      .tripleOccupancy
                  }
                  onChange={(
                    event
                  ) =>
                    updateAccommodationDetails(
                      "tripleOccupancy",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>
            </div>

            {/* ================================================= */}
            {/* SAVE FOOTER */}
            {/* ================================================= */}

            {!isReadOnly ? (
              <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/10 px-6 py-5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    isSaving
                  }
                  onClick={() =>
                    router.push(
                      "/bookings"
                    )
                  }
                  className="h-10 rounded-sm"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={
                    isSaving
                  }
                  className="h-10 rounded-sm px-5 font-bold"
                >
                  <Save className="size-4" />

                  {isSaving
                    ? "Saving..."
                    : mode ===
                        "edit"
                      ? "Update Booking"
                      : "Save Booking"}
                </Button>
              </div>
            ) : null}
          </form>
        ) : null}
      </div>
    </AdminDashboardShell>
  );
}

/* =========================================================
   DATE PICKER
========================================================= */

function DatePicker({
  value,
  onChange,
  readOnly = false,
  triggerClassName,
}: {
  value: string;

  onChange: (
    value: string
  ) => void;

  readOnly?: boolean;

  triggerClassName?: string;
}) {
  const [
    isOpen,
    setIsOpen,
  ] =
    useState(false);

  const selectedDate =
    parseDateInputValue(
      value
    );

  const currentYear =
    new Date().getFullYear();

  return (
    <Popover
      open={isOpen}
      onOpenChange={(
        open
      ) => {
        if (
          !readOnly
        ) {
          setIsOpen(
            open
          );
        }
      }}
    >
      <PopoverTrigger
        type="button"
        disabled={
          readOnly
        }
        className={cn(
          triggerClassName,
          "flex w-full items-center justify-between gap-3 text-left font-medium",
          !value &&
            "text-foreground/45"
        )}
      >
        <span>
          {formatDatePickerValue(
            value
          )}
        </span>

        <CalendarDays className="size-4 shrink-0 text-foreground/55" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-3"
      >
        <Calendar
          key={
            value ||
            "empty-date"
          }
          selected={
            selectedDate
          }
          showMonthYearDropdowns
          yearRange={{
            from:
              currentYear -
              120,

            to:
              currentYear,
          }}
          onSelect={(
            date
          ) => {
            onChange(
              dateToInputValue(
                date
              )
            );

            setIsOpen(
              false
            );
          }}
          onClear={() => {
            onChange("");

            setIsOpen(
              false
            );
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/* =========================================================
   FORM SECTION
========================================================= */

function FormSectionTitle({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border pb-2 sm:col-span-2">
      <h3 className="text-sm font-bold text-foreground">
        {children}
      </h3>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

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
    <label
      className={cn(
        "flex min-w-0 flex-col gap-2",
        className
      )}
    >
      <span className="text-xs font-bold uppercase text-foreground/55">
        {label}

        {required ? (
          <span className="text-primary">
            {" "}
            *
          </span>
        ) : null}
      </span>

      {children}
    </label>
  );
}
