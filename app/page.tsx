export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 border-b">
        <h1 className="text-2xl font-bold">
          StudentDash
        </h1>

        <div className="flex items-center gap-4">
          <button className="text-gray-700 hover:text-black">
            Login
          </button>

          <button className="rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">

        <h2 className="max-w-3xl text-5xl font-bold leading-tight">
          Your academic life,
          <br />
          all in one place.
        </h2>

        <p className="mt-6 max-w-xl text-lg text-gray-600">
           Track your GPA, assignments, transfer apps, academic progress, and much more — built to make student life simpler.
        </p>

        <button className="mt-8 rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800">
          Start for Free
        </button>

      </section>
      {/* Features Section */}
<section className="bg-gray-50 px-8 py-20">

  <div className="mx-auto max-w-6xl text-center">
    <h2 className="text-3xl font-bold">
      Everything you need to stay on track
    </h2>

    <p className="mt-3 text-gray-600">
      Simple tools designed around student life.
    </p>

    <div className="mt-12 grid gap-6 md:grid-cols-3">

      {/* GPA Tracker */}
      <div className="rounded-xl border bg-white p-6 text-left">
        <h3 className="text-xl font-semibold">
          GPA Tracker
        </h3>

        <p className="mt-3 text-gray-600">
          Add your courses and semesters to keep track of your GPA.
        </p>
      </div>

      {/* Assignment Tracker */}
      <div className="rounded-xl border bg-white p-6 text-left">
        <h3 className="text-xl font-semibold">
          Assignment Tracker
        </h3>

        <p className="mt-3 text-gray-600">
          Keep track of assignments, deadlines, priorities, and progress.
        </p>
      </div>

      {/* Transfer Tracker */}
      <div className="rounded-xl border bg-white p-6 text-left">
        <h3 className="text-xl font-semibold">
          Transfer Tracker
        </h3>

        <p className="mt-3 text-gray-600">
          Organize universities, application deadlines, statuses, and notes.
        </p>
      </div>

    </div>
  </div>

</section>

    </main>
  );
}