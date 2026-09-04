export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900">
          StudentDash
        </h1>

        <p className="mt-4 text-lg text-gray-600">
          Your academic life, all in one place.
        </p>

        <button className="mt-6 rounded-lg bg-black px-6 py-3 text-white">
          Get Started
        </button>
      </div>
    </main>
  );
}