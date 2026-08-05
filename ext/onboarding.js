const driver = window.driver.js.driver;

driverObj.highlight({
   element: "#some-element",
   popover: {
      title: "Title",
      description: "Description"
   }
});

const driverObj = driver({
   showProgress: true,
   steps: [
      { element: '#tour-example', popover: { title: 'Animated Tour Example', description: 'Here is the code example showing animated tour. Let\'s walk you through it.', side: "left", align: 'start' }},
      { element: 'code .line:nth-child(1)', popover: { title: 'Import the Library', description: 'It works the same in vanilla JavaScript as well as frameworks.', side: "bottom", align: 'start' }},
      { element: 'code .line:nth-child(2)', popover: { title: 'Importing CSS', description: 'Import the CSS which gives you the default styling for popover and overlay.', side: "bottom", align: 'start' }},
      { element: 'code .line:nth-child(4) span:nth-child(7)', popover: { title: 'Create Driver', description: 'Simply call the driver function to create a driver.js instance', side: "left", align: 'start' }},
      { element: 'code .line:nth-child(18)', popover: { title: 'Start Tour', description: 'Call the drive method to start the tour and your tour will be started.', side: "top", align: 'start' }},
      { element: 'a[href="/docs/configuration"]', popover: { title: 'More Configuration', description: 'Look at this page for all the configuration options you can pass.', side: "right", align: 'start' }},
      { popover: { title: 'Happy Coding', description: 'And that is all, go ahead and start adding tours to your applications.' } }
   ]
});

driverObj.drive();



type Popover = {
   // Title and descriptions shown in the popover.
   // You can use HTML in these. Also, you can
   // omit one of these to show only the other.
   title?: string;
   description?: string;
 
   // The position and alignment of the popover
   // relative to the target element.
   side?: "top" | "right" | "bottom" | "left";
   align?: "start" | "center" | "end";
 
   // Array of buttons to show in the popover.
   // When highlighting a single element, there
   // are no buttons by default. When showing
   // a tour, the default buttons are "next",
   // "previous" and "close".
   showButtons?: ("next" | "previous" | "close")[];
   // An array of buttons to disable. This is
   // useful when you want to show some of the
   // buttons, but disable some of them.
   disableButtons?: ("next" | "previous" | "close")[];
 
   // Text to show in the buttons. `doneBtnText`
   // is used on the last step of a tour.
   nextBtnText?: string;
   prevBtnText?: string;
   doneBtnText?: string;
 
   // Whether to show the progress text in popover.
   showProgress?: boolean;
   // Template for the progress text. You can use
   // the following placeholders in the template:
   //   - {{current}}: The current step number
   //   - {{total}}: Total number of steps
   // Defaults to following if `showProgress` is true:
   //   - "{{current}} of {{total}}"
   progressText?: string;
 
   // Custom class to add to the popover element.
   // This can be used to style the popover.
   popoverClass?: string;
 
   // Hook to run after the popover is rendered.
   // You can modify the popover element here.
   // Parameter is an object with references to
   // the popover DOM elements such as buttons
   // title, descriptions, body, etc.
   onPopoverRender?: (popover: PopoverDOM, options: { config: Config; state: State }) => void;
 
   // Callbacks for button clicks. You can use
   // these to add custom behavior to the buttons.
   // Each callback receives the following parameters:
   //   - element: The current DOM element of the step
   //   - step: The step object configured for the step
   //   - options.config: The current configuration options
   //   - options.state: The current state of the driver
   onNextClick?: (element?: Element, step: DriveStep, options: { config: Config; state: State }) => void
   onPrevClick?: (element?: Element, step: DriveStep, options: { config: Config; state: State }) => void
   onCloseClick?: (element?: Element, step: DriveStep, options: { config: Config; state: State }) => void
 }



 import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// Look at the configuration section for the options
// https://driverjs.com/docs/configuration#driver-configuration
const driverObj = driver({ /* ... */ });

// --------------------------------------------------
// driverObj is an object with the following methods
// --------------------------------------------------

// Start the tour using `steps` given in the configuration
driverObj.drive();  // Starts at step 0
driverObj.drive(4); // Starts at step 4

driverObj.moveNext(); // Move to the next step
driverObj.movePrevious(); // Move to the previous step
driverObj.moveTo(4); // Move to the step 4
driverObj.hasNextStep(); // Is there a next step
driverObj.hasPreviousStep() // Is there a previous step

driverObj.isFirstStep(); // Is the current step the first step
driverObj.isLastStep(); // Is the current step the last step

driverObj.getActiveIndex(); // Gets the active step index

driverObj.getActiveStep(); // Gets the active step configuration
driverObj.getPreviousStep(); // Gets the previous step configuration
driverObj.getActiveElement(); // Gets the active HTML element
driverObj.getPreviousElement(); // Gets the previous HTML element

// Is the tour or highlight currently active
driverObj.isActive();

// Recalculate and redraw the highlight
driverObj.refresh();

// Look at the configuration section for configuration options
// https://driverjs.com/docs/configuration#driver-configuration
driverObj.getConfig();
driverObj.setConfig({ /* ... */ });

driverObj.setSteps([ /* ... */ ]); // Set the steps

// Look at the state section of configuration for format of the state
// https://driverjs.com/docs/configuration#state
driverObj.getState();

// Look at the DriveStep section of configuration for format of the step
// https://driverjs.com/docs/configuration/#drive-step-configuration
driverObj.highlight({ /* ... */ }); // Highlight an element

driverObj.destroy(); // Destroy the tour




## Change Button Text

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const driverObj = driver({
  nextBtnText: '—›',
  prevBtnText: '‹—',
  doneBtnText: '✕',
  showProgress: true,
  steps: [
    // ...
  ]
});

driverObj.drive();


## Event Handlers
You can use the onNextClick, onPreviousClick and onCloseClick callbacks to implement custom functionality when the user clicks on the next and previous buttons.

Please note that when you configure these callbacks, the default functionality of the buttons will be disabled. You will have to implement the functionality yourself.

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const driverObj = driver({
  onNextClick:() => {
    console.log('Next Button Clicked');
    // Implement your own functionality here
    driverObj.moveNext();
  },
  onPrevClick:() => {
    console.log('Previous Button Clicked');
    // Implement your own functionality here
    driverObj.movePrevious();
  },
  onCloseClick:() => {
    console.log('Close Button Clicked');
    // Implement your own functionality here
    driverObj.destroy();
  },
  steps: [
    // ...
  ]
});

driverObj.drive();


## Custom Buttons
You can add custom buttons using onPopoverRender callback. This callback is called before the popover is rendered. In the following example, we are adding a custom button that takes the user to the first step.
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const driverObj = driver({
  // Get full control over the popover rendering.
  // Here we are adding a custom button that takes
  // user to the first step.
  onPopoverRender: (popover, { config, state }) => {
    const firstButton = document.createElement("button");
    firstButton.innerText = "Go to First";
    popover.footerButtons.appendChild(firstButton);

    firstButton.addEventListener("click", () => {
      driverObj.drive(0);
    });
  },
  steps: [
    // ..
  ]
});

driverObj.drive();

## Popover avec GIF

const driverObj = driver();

driverObj.highlight({
  popover: {
    description: "<img src='https://i.imgur.com/EAQhHu5.gif' style='height: 202.5px; width: 270px;' /><span style='font-size: 15px; display: block; margin-top: 10px; text-align: center;'>Yet another highlight example.</span>",
  }
})


## Exemple de tour sur un formulaire

const driverObj = driver({
   popoverClass: "driverjs-theme",
   stagePadding: 0,
   onDestroyed: () => {
     document?.activeElement?.blur();
   }
 });
 
 const nameEl = document.getElementById("name");
 const educationEl = document.getElementById("education");
 const ageEl = document.getElementById("age");
 const addressEl = document.getElementById("address");
 const formEl = document.querySelector("form");
 
 nameEl.addEventListener("focus", () => {
   driverObj.highlight({
     element: nameEl,
     popover: {
       title: "Name",
       description: "Enter your name here",
     },
   });
 });
 
 educationEl.addEventListener("focus", () => {
   driverObj.highlight({
     element: educationEl,
     popover: {
       title: "Education",
       description: "Enter your education here",
     },
   });
 });
 
 ageEl.addEventListener("focus", () => {
   driverObj.highlight({
     element: ageEl,
     popover: {
       title: "Age",
       description: "Enter your age here",
     },
   });
 });
 
 addressEl.addEventListener("focus", () => {
   driverObj.highlight({
     element: addressEl,
     popover: {
       title: "Address",
       description: "Enter your address here",
     },
   });
 });
 
 formEl.addEventListener("blur", () => {
   driverObj.destroy();
 });


## Async tour

Async Tour
You can also have async steps in your tour. This is useful when you want to load some data from the server and then show the tour.

Asynchronous Tour

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const driverObj = driver({
  showProgress: true,
  steps: [
    {
      popover: {
        title: 'First Step',
        description: 'This is the first step. Next element will be loaded dynamically.'
        // By passing onNextClick, you can override the default behavior of the next button.
        // This will prevent the driver from moving to the next step automatically.
        // You can then manually call driverObj.moveNext() to move to the next step.
        onNextClick: () => {
          // .. load element dynamically
          // .. and then call
          driverObj.moveNext();
        },
      },
    },
    {
      element: '.dynamic-el',
      popover: {
        title: 'Async Element',
        description: 'This element is loaded dynamically.'
      },
      // onDeselected is called when the element is deselected.
      // Here we are simply removing the element from the DOM.
      onDeselected: () => {
        // .. remove element
        document.querySelector(".dynamic-el")?.remove();
      }
    },
    { popover: { title: 'Last Step', description: 'This is the last step.' } }
  ]

});

driverObj.drive();
Show me an Example
Note: By overriding onNextClick, and onPrevClick hooks you control the navigation of the driver. This means that user won’t be able to navigate using the buttons and you will have to either call driverObj.moveNext() or driverObj.movePrevious() to navigate to the next/previous step.

You can use this to implement custom logic for navigating between steps. This is also useful when you are dealing with dynamic content and want to highlight the next/previous element based on some logic.

onNextClick and onPrevClick hooks can be configured at driver level as well as step level. When configured at the driver level, you control the navigation for all the steps. When configured at the step level, you control the navigation for that particular step only.
