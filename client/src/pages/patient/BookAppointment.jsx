import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import BookingForm from '../../components/BookingForm.jsx';
import { PageHeader } from '../../components/ui/ui.jsx';

export default function BookAppointment() {
  const { doctorId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Book an appointment" subtitle="Choose a doctor, a date and a time. Only times that are really free are shown." />
      <BookingForm initialDoctorId={doctorId ?? ''} initialDate={params.get('date') ?? undefined} onBooked={(a) => navigate(`/patient/appointments/${a.id}/confirmation`, { replace: true })} />
    </>
  );
}
