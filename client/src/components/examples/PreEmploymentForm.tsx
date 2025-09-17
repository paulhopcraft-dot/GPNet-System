import PreEmploymentForm from '../PreEmploymentForm'

export default function PreEmploymentFormExample() {
  return (
    <div className="p-6 bg-muted/50 min-h-screen">
      <PreEmploymentForm 
        onSubmit={(data) => console.log('Form submitted:', data)}
        isSubmitting={false}
      />
    </div>
  )
}