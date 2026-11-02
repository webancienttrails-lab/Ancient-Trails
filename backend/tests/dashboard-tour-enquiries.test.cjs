const test = require("node:test");
const assert = require("node:assert/strict");
const { createTourEnquiryCounts } = require("../dist/services/dashboard-tour-enquiries");

test("counts tour enquiries once using ID, with name fallback, excluding general enquiries", () => {
  const tours = [
    { tourId: "T1", tourName: "Ellora" },
    { tourId: "T2", tourName: "Hampi" },
    { tourId: "T3", tourName: "Egypt" },
  ];
  const result = createTourEnquiryCounts(tours, [
    { subject: "Tour enquiry - Old name", message: "Hello\nTour: Old name\nTour ID: T1\nGuests: 2" },
    { subject: "Tour enquiry - Ellora", message: "Tour: Ellora\nTour ID: T1" },
    { subject: "Tour enquiry - hampi", message: "Please call me" },
    { subject: "Contact", message: "I am interested in Ellora" },
    { subject: "Tour enquiry - Ellora", message: "Tour ID: DELETED" },
  ]);
  assert.deepEqual(result, [
    { tourId: "T1", title: "Ellora", enquiries: 2 },
    { tourId: "T2", title: "Hampi", enquiries: 1 },
    { tourId: "T3", title: "Egypt", enquiries: 0 },
  ]);
});

test("handles an empty tour list and tours with no enquiries", () => {
  assert.deepEqual(createTourEnquiryCounts([], []), []);
  assert.deepEqual(createTourEnquiryCounts([{ tourId: "T1", tourName: "Ellora" }], []), [
    { tourId: "T1", title: "Ellora", enquiries: 0 },
  ]);
});
