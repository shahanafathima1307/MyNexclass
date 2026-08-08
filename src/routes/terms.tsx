import { createFileRoute } from "@tanstack/react-router";
import { LegalSection, MarketingShell } from "@/components/marketing-shell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — myNexClass" },
      {
        name: "description",
        content:
          "The terms that apply when you use myNexClass to book, teach, attend or record tutoring classes.",
      },
      { property: "og:title", content: "Terms of Service — myNexClass" },
      {
        property: "og:description",
        content: "The terms that apply when you use myNexClass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <MarketingShell
      eyebrow="Legal"
      title="Terms of Service"
      intro="This page is maintained by the myNexClass team and describes the rules for using the service. It is a plain-language summary, not legal advice — have a lawyer review it before you rely on it commercially."
    >
      <LegalSection heading="1. Using myNexClass">
        <p>
          myNexClass connects tutors and students so they can schedule classes, meet in a live room and
          keep a record of the lesson. You need an account to use anything beyond the public pages,
          and you are responsible for what happens under your account.
        </p>
        <p>
          You must be old enough to enter an agreement where you live. If a student is a minor, a
          parent or guardian is responsible for the account and for the classes booked with it.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your account">
        <p>
          Keep your password to yourself and tell us promptly if you think someone else has access.
          Do not create accounts for other people without their consent, and do not impersonate a
          tutor, a student or a member of staff.
        </p>
        <p>
          Accounts have roles — student, tutor or admin. Roles control what you can see and do, and
          only an admin can change them.
        </p>
      </LegalSection>

      <LegalSection heading="3. Classes and conduct">
        <p>
          Tutors set their own availability, subjects and rates. Students request classes and tutors
          accept or decline them. myNexClass provides the tools but is not a party to the teaching
          arrangement between a tutor and a student, and does not supervise lesson content.
        </p>
        <p>
          Behave decently in the class room and in messages. Harassment, abusive language, sharing
          someone else's private material and any illegal activity are grounds for removing an
          account without notice.
        </p>
      </LegalSection>

      <LegalSection heading="4. Recordings and lesson material">
        <p>
          Recordings and notes uploaded to a class are visible only to the participants of that
          class. Do not record, download or redistribute a class outside myNexClass without the
          agreement of everyone in it. You keep ownership of material you upload and give myNexClass
          only the permission needed to store it and show it to the class participants.
        </p>
      </LegalSection>

      <LegalSection heading="5. Payments">
        <p>
          myNexClass is currently free to use and does not collect card details. When paid plans and
          class payments are introduced, the pricing, refund and payout terms will be published
          before they take effect and you will be able to review them.
        </p>
      </LegalSection>

      <LegalSection heading="6. Availability of the service">
        <p>
          We aim to keep myNexClass running reliably, but the service is provided as-is. Live video
          depends on your network and your device, and occasional maintenance or outages will
          happen. We are not liable for lessons missed because of a technical fault, and our overall
          liability is limited to the amount you have paid us, which is currently nothing.
        </p>
      </LegalSection>

      <LegalSection heading="7. Ending your use">
        <p>
          You can stop using myNexClass at any time and ask us to delete your account. We may suspend
          or close an account that breaks these terms. Class records belonging to other participants
          may remain visible to them after your account is closed.
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes and contact">
        <p>
          We will update this page when the service changes, and material changes will be announced
          in the app. Questions go to hello@mynexclass.lovable.app.
        </p>
      </LegalSection>
    </MarketingShell>
  );
}
