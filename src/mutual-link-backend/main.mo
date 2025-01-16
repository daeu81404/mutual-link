import DoctorManagement "./DoctorManagement";
import Result "mo:base/Result";
import Nat "mo:base/Nat";

actor {
  private let doctorManager = DoctorManagement.DoctorManager();

  public shared(msg) func updateDoctor(doctor: DoctorManagement.Doctor) : async Result.Result<DoctorManagement.Doctor, Text> {
    doctorManager.updateDoctor(doctor)
  };

  public shared(msg) func deleteDoctor(id: Nat) : async Result.Result<(), Text> {
    doctorManager.deleteDoctor(id)
  };

  public query func getAllDoctors() : async [DoctorManagement.Doctor] {
    doctorManager.getAllDoctors()
  };

  public query func getDoctor(id: Nat) : async ?DoctorManagement.Doctor {
    doctorManager.getDoctor(id)
  };

  public shared(msg) func updateDoctorPublicKey(email: Text, publicKey: Text) : async Result.Result<DoctorManagement.Doctor, Text> {
    doctorManager.updateDoctorPublicKey(email, publicKey)
  };

  public query func getDoctorByEmail(email: Text) : async ?DoctorManagement.Doctor {
    doctorManager.getDoctorByEmail(email)
  };
};
