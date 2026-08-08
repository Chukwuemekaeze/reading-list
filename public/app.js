"use strict";

// Small vanilla-JS client for the Reading List API. No frameworks, no build.

const STATUS_LABELS = {
  "to-read": "To read",
  reading: "Reading",
  done: "Done",
};

const els = {
  form: document.getElementById("book-form"),
  formTitle: document.getElementById("form-title"),
  id: document.getElementById("book-id"),
  title: document.getElementById("title"),
  author: document.getElementById("author"),
  status: document.getElementById("status"),
  rating: document.getElementById("rating"),
  tags: document.getElementById("tags"),
  submitBtn: document.getElementById("submit-btn"),
  cancelBtn: document.getElementById("cancel-btn"),
  formError: document.getElementById("form-error"),
  filterStatus: document.getElementById("filter-status"),
  listStatus: document.getElementById("list-status"),
  list: document.getElementById("book-list"),
};

// Escape user-provided text before inserting it into the DOM as a string.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) {
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data.error || (data.errors && data.errors.join(", ")) || "Request failed";
    throw new Error(message);
  }
  return data;
}

function parseTags(raw) {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");
}

function showFormError(message) {
  els.formError.textContent = message;
  els.formError.classList.remove("hidden");
}

function clearFormError() {
  els.formError.textContent = "";
  els.formError.classList.add("hidden");
}

function resetForm() {
  els.form.reset();
  els.id.value = "";
  els.formTitle.textContent = "Add a book";
  els.submitBtn.textContent = "Add book";
  els.cancelBtn.classList.add("hidden");
  clearFormError();
}

function fillFormForEdit(book) {
  els.id.value = book._id;
  els.title.value = book.title;
  els.author.value = book.author;
  els.status.value = book.status;
  els.rating.value = book.rating === null ? "" : String(book.rating);
  els.tags.value = book.tags.join(", ");
  els.formTitle.textContent = "Edit book";
  els.submitBtn.textContent = "Save changes";
  els.cancelBtn.classList.remove("hidden");
  clearFormError();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderBook(book) {
  const li = document.createElement("li");
  li.className = "book-item";

  const ratingHtml =
    book.rating === null
      ? ""
      : `<span class="rating">Rating ${book.rating}/5</span>`;

  const tagsHtml =
    book.tags.length === 0
      ? ""
      : `<span class="tags">${book.tags
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join("")}</span>`;

  li.innerHTML = `
    <div class="book-main">
      <div>
        <p class="book-title">${escapeHtml(book.title)}</p>
        <p class="book-author">by ${escapeHtml(book.author)}</p>
      </div>
      <div class="book-actions">
        <button type="button" class="secondary" data-action="edit">Edit</button>
        <button type="button" class="link-danger" data-action="delete">Delete</button>
      </div>
    </div>
    <div class="book-meta">
      <span class="badge ${book.status}">${STATUS_LABELS[book.status] || book.status}</span>
      ${ratingHtml}
      ${tagsHtml}
    </div>
  `;

  li.querySelector('[data-action="edit"]').addEventListener("click", () =>
    fillFormForEdit(book)
  );
  li.querySelector('[data-action="delete"]').addEventListener("click", () =>
    handleDelete(book)
  );

  return li;
}

async function loadBooks() {
  els.listStatus.textContent = "Loading...";
  els.listStatus.classList.remove("hidden");
  els.list.innerHTML = "";
  try {
    const status = els.filterStatus.value;
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const books = await api(`/api/books${query}`);
    if (books.length === 0) {
      els.listStatus.textContent = status
        ? "No books with this status yet."
        : "No books yet. Add your first one on the left.";
      return;
    }
    els.listStatus.classList.add("hidden");
    const frag = document.createDocumentFragment();
    books.forEach((book) => frag.appendChild(renderBook(book)));
    els.list.appendChild(frag);
  } catch (err) {
    els.listStatus.textContent = `Could not load books: ${err.message}`;
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  clearFormError();

  const ratingRaw = els.rating.value;
  const payload = {
    title: els.title.value.trim(),
    author: els.author.value.trim(),
    status: els.status.value,
    rating: ratingRaw === "" ? null : Number(ratingRaw),
    tags: parseTags(els.tags.value),
  };

  const id = els.id.value;
  els.submitBtn.disabled = true;
  try {
    if (id) {
      await api(`/api/books/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/books", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    await loadBooks();
  } catch (err) {
    showFormError(err.message);
  } finally {
    els.submitBtn.disabled = false;
  }
}

async function handleDelete(book) {
  const ok = window.confirm(`Delete "${book.title}"?`);
  if (!ok) {
    return;
  }
  try {
    await api(`/api/books/${book._id}`, { method: "DELETE" });
    // If we were editing this book, reset the form.
    if (els.id.value === book._id) {
      resetForm();
    }
    await loadBooks();
  } catch (err) {
    els.listStatus.classList.remove("hidden");
    els.listStatus.textContent = `Could not delete: ${err.message}`;
  }
}

els.form.addEventListener("submit", handleSubmit);
els.cancelBtn.addEventListener("click", resetForm);
els.filterStatus.addEventListener("change", loadBooks);

loadBooks();
