/**
 * contact-form.js — accessible client-side validation.
 * Mirrors native `required`/`type` constraints so this is a progressive
 * enhancement, not a replacement for server-side / native validation.
 * On invalid submit: focuses the first invalid field and announces
 * a live status message via aria-live, without a page reload.
 */
(function () {
  "use strict";

  function initContactForm() {
    var form = document.getElementById("contact-form");
    if (!form) return;

    var status = document.getElementById("form-status");

    var validators = {
      name: function (value) {
        return value.trim().length > 0 ? "" : "Enter your name.";
      },
      email: function (value) {
        var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (value.trim().length === 0) return "Enter your email address.";
        if (!pattern.test(value.trim())) return "Enter a valid email address, like name@example.com.";
        return "";
      },
      reason: function (value) {
        return value ? "" : "Choose a reason for getting in touch.";
      },
      message: function (value) {
        return value.trim().length > 0 ? "" : "Enter a message.";
      }
    };

    function setFieldState(fieldName, errorMessage) {
      var input = form.elements[fieldName];
      var wrapper = input.closest(".field") || input.closest("fieldset");
      var errorEl = document.getElementById(fieldName + "-error");

      if (errorMessage) {
        wrapper.setAttribute("data-invalid", "true");
        if (errorEl) errorEl.textContent = errorMessage;
        if (input.setAttribute) {
          input.setAttribute("aria-invalid", "true");
        } else {
          // radio group: mark each input
          form.querySelectorAll('[name="' + fieldName + '"]').forEach(function (el) {
            el.setAttribute("aria-invalid", "true");
          });
        }
      } else {
        wrapper.setAttribute("data-invalid", "false");
        if (errorEl) errorEl.textContent = "";
        if (input.setAttribute) {
          input.removeAttribute("aria-invalid");
        } else {
          form.querySelectorAll('[name="' + fieldName + '"]').forEach(function (el) {
            el.removeAttribute("aria-invalid");
          });
        }
      }
    }

    function getValue(fieldName) {
      var field = form.elements[fieldName];
      if (field instanceof RadioNodeList) {
        return field.value || "";
      }
      return field.value;
    }

    function validateField(fieldName) {
      var message = validators[fieldName](getValue(fieldName));
      setFieldState(fieldName, message);
      return message === "";
    }

    // Validate on blur for immediate, non-intrusive feedback.
    ["name", "email", "message"].forEach(function (fieldName) {
      form.elements[fieldName].addEventListener("blur", function () {
        validateField(fieldName);
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var fieldNames = ["name", "email", "reason", "message"];
      var firstInvalidName = null;

      fieldNames.forEach(function (fieldName) {
        var valid = validateField(fieldName);
        if (!valid && !firstInvalidName) {
          firstInvalidName = fieldName;
        }
      });

      if (firstInvalidName) {
        var fieldToFocus = form.elements[firstInvalidName];
        var target = fieldToFocus instanceof RadioNodeList ? fieldToFocus[0] : fieldToFocus;
        target.focus();

        status.setAttribute("data-show", "true");
        status.textContent = "There's a problem with the form. Please review the highlighted fields.";
        return;
      }

      // No backend wired up in this skeleton — confirm success in place.
      form.hidden = true;
      status.setAttribute("data-show", "true");
      status.textContent = "Thanks — your message has been noted. (Demo only: no data was sent.)";
      status.focus();
    });
  }

  document.addEventListener("DOMContentLoaded", initContactForm);
})();
