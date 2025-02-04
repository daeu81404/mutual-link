import DoctorManagement "./DoctorManagement";
import MedicalRecordManagement "./MedicalRecordManagement";
import Result "mo:base/Result";
import Nat "mo:base/Nat";

actor {
  private let doctorManager = DoctorManagement.DoctorManager();
  private let medicalRecordManager = MedicalRecordManagement.MedicalRecordManager(doctorManager);

  public shared (_) func createDoctor(doctor: DoctorManagement.Doctor) : async Result.Result<DoctorManagement.Doctor, Text> {
    doctorManager.createDoctor(doctor)
  };

  public shared (_) func updateDoctor(doctor: DoctorManagement.Doctor) : async Result.Result<DoctorManagement.Doctor, Text> {
    doctorManager.updateDoctor(doctor)
  };

  public shared (_) func deleteDoctor(id: Nat) : async Result.Result<(), Text> {
    doctorManager.deleteDoctor(id)
  };

  public query func getPagedDoctors(offset: Nat, limit: Nat) : async DoctorManagement.PagedResult {
    doctorManager.getAllDoctors(offset, limit)
  };

  public query func getDoctor(id: Nat) : async ?DoctorManagement.Doctor {
    doctorManager.getDoctor(id)
  };

  public shared(msg) func updateDoctorPublicKey(email: Text, publicKey: Text) : async Result.Result<DoctorManagement.Doctor, Text> {
    doctorManager.updateDoctorPublicKey(email, ?publicKey)
  };

  public query func getDoctorByEmail(email: Text) : async ?DoctorManagement.Doctor {
    doctorManager.getDoctorByEmail(email)
  };

  public query func searchDoctors(searchType: Text, searchQuery: Text, offset: Nat, limit: Nat) : async DoctorManagement.PagedResult {
    doctorManager.searchDoctors(searchType, searchQuery, offset, limit)
  };

  public shared (_) func createMedicalRecord(
    patientName: Text,
    patientPhone: Text,
    title: Text,
    description: Text,
    fromEmail: Text,
    toEmail: Text,
    cid: Text,
    encryptedAesKeyForSender: Text,
    encryptedAesKeyForReceiver: Text
  ) : async Result.Result<MedicalRecordManagement.MedicalRecord, Text> {
    medicalRecordManager.createMedicalRecord(
      patientName,
      patientPhone,
      title,
      description,
      fromEmail,
      toEmail,
      cid,
      encryptedAesKeyForSender,
      encryptedAesKeyForReceiver
    )
  };

  public shared (_) func updateMedicalRecordStatus(id: Nat, status: Text) : async Result.Result<MedicalRecordManagement.MedicalRecord, Text> {
    medicalRecordManager.updateMedicalRecordStatus(id, status)
  };

  public query func getPagedMedicalRecords(offset: Nat, limit: Nat) : async MedicalRecordManagement.PagedResult {
    medicalRecordManager.getAllMedicalRecords(offset, limit)
  };

  public query func getMedicalRecordsByDoctor(doctorName: Text, role: Text, offset: Nat, limit: Nat) : async MedicalRecordManagement.PagedResult {
    medicalRecordManager.getMedicalRecordsByDoctor(doctorName, role, offset, limit)
  };

  public query func getMedicalRecord(id: Nat) : async ?MedicalRecordManagement.MedicalRecord {
    medicalRecordManager.getMedicalRecord(id)
  };

  public query func getTransferHistory(recordId: Nat) : async [MedicalRecordManagement.MedicalRecord] {
    medicalRecordManager.getTransferHistory(recordId)
  };

  public shared (_) func transferMedicalRecord(
    recordId: Nat,
    fromEmail: Text,
    toEmail: Text,
    encryptedAesKeyForSender: Text,
    encryptedAesKeyForReceiver: Text
  ) : async Result.Result<MedicalRecordManagement.MedicalRecord, Text> {
    medicalRecordManager.transferMedicalRecord(
      recordId,
      fromEmail,
      toEmail,
      encryptedAesKeyForSender,
      encryptedAesKeyForReceiver
    )
  };
};
